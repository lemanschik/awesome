/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { renderMarkdown } from 'vs/base/browser/markdownRenderer';
import { Barrier, raceCancellationError } from 'vs/base/common/async';
import { CancellationTokenSource } from 'vs/base/common/cancellation';
import { Emitter, Event } from 'vs/base/common/event';
import { DisposableStore, toDisposable } from 'vs/base/common/lifecycle';
import { isEqual } from 'vs/base/common/resources';
import { StopWatch } from 'vs/base/common/stopwatch';
import { assertType } from 'vs/base/common/types';
import 'vs/css!./interactiveEditor';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { EditOperation } from 'vs/editor/common/core/editOperation';
import { Position } from 'vs/editor/common/core/position';
import { IRange, Range } from 'vs/editor/common/core/range';
import { IEditorContribution } from 'vs/editor/common/editorCommon';
import { ModelDecorationOptions, createTextBufferFactoryFromSnapshot } from 'vs/editor/common/model/textModel';
import { IEditorWorkerService } from 'vs/editor/common/services/editorWorker';
import { IModelService } from 'vs/editor/common/services/model';
import { InlineCompletionsController } from 'vs/editor/contrib/inlineCompletions/browser/inlineCompletionsController';
import { localize } from 'vs/nls';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IContextKey, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { ILogService } from 'vs/platform/log/common/log';
import { EditResponse, EmptyResponse, ErrorResponse, IInteractiveEditorSessionService, MarkdownResponse, Session, SessionExchange } from 'vs/workbench/contrib/interactiveEditor/browser/interactiveEditorSession';
import { EditModeStrategy, LivePreviewStrategy, LiveStrategy, PreviewStrategy } from 'vs/workbench/contrib/interactiveEditor/browser/interactiveEditorStrategies';
import { InteractiveEditorZoneWidget } from 'vs/workbench/contrib/interactiveEditor/browser/interactiveEditorWidget';
import { CTX_INTERACTIVE_EDITOR_HAS_ACTIVE_REQUEST, CTX_INTERACTIVE_EDITOR_LAST_EDIT_TYPE as CTX_INTERACTIVE_EDITOR_LAST_EDIT_KIND, CTX_INTERACTIVE_EDITOR_LAST_FEEDBACK as CTX_INTERACTIVE_EDITOR_LAST_FEEDBACK_KIND, IInteractiveEditorRequest, IInteractiveEditorResponse, INTERACTIVE_EDITOR_ID, EditMode, InteractiveEditorResponseFeedbackKind, CTX_INTERACTIVE_EDITOR_LAST_RESPONSE_TYPE, InteractiveEditorResponseType } from 'vs/workbench/contrib/interactiveEditor/common/interactiveEditor';
import { IInteractiveSessionWidgetService } from 'vs/workbench/contrib/interactiveSession/browser/interactiveSession';
import { IInteractiveSessionService } from 'vs/workbench/contrib/interactiveSession/common/interactiveSessionService';
import { INotebookEditorService } from 'vs/workbench/contrib/notebook/browser/services/notebookEditorService';
import { CellUri } from 'vs/workbench/contrib/notebook/common/notebookCommon';

const enum State {
	CREATE_SESSION,
	INIT_UI,
	WAIT_FOR_INPUT,
	MAKE_REQUEST,
	APPLY_RESPONSE,
	SHOW_RESPONSE,
	PAUSE,
	DONE,
}

const enum Message {
	NONE = 0,
	END_SESSION = 2 ** 0,
	PAUSE_SESSION = 2 ** 1,
	CANCEL_REQUEST = 2 ** 2,
	CANCEL_INPUT = 2 ** 3,
	ACCEPT_INPUT = 2 ** 4
}

export interface InteractiveEditorRunOptions {
	initialRange?: IRange;
	message?: string;
	autoSend?: boolean;
	existingSession?: Session;
}

export class InteractiveEditorController implements IEditorContribution {

	static get(editor: ICodeEditor) {
		return editor.getContribution<InteractiveEditorController>(INTERACTIVE_EDITOR_ID);
	}

	private static _decoBlock = ModelDecorationOptions.register({
		description: 'interactive-editor',
		showIfCollapsed: false,
		isWholeLine: true,
		className: 'interactive-editor-block-selection',
	});

	private static _promptHistory: string[] = [];
	private _historyOffset: number = -1;

	private readonly _store = new DisposableStore();
	private readonly _zone: InteractiveEditorZoneWidget;
	private readonly _ctxHasActiveRequest: IContextKey<boolean>;
	private readonly _ctxLastResponseType: IContextKey<undefined | InteractiveEditorResponseType>;
	private readonly _ctxLastEditKind: IContextKey<'' | 'simple'>;
	private readonly _ctxLastFeedbackKind: IContextKey<'helpful' | 'unhelpful' | ''>;

	private _strategy?: EditModeStrategy;

	private _activeSession?: Session;
	private _sessionStore?: DisposableStore;
	private _ignoreModelContentChanged = false;
	private _messages = this._store.add(new Emitter<Message>());

	constructor(
		private readonly _editor: ICodeEditor,
		@IInstantiationService private readonly _instaService: IInstantiationService,
		@IInteractiveEditorSessionService private readonly _interactiveEditorSessionService: IInteractiveEditorSessionService,
		@IEditorWorkerService private readonly _editorWorkerService: IEditorWorkerService,
		@ILogService private readonly _logService: ILogService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IModelService private readonly _modelService: IModelService,
		@INotebookEditorService private readonly _notebookEditorService: INotebookEditorService,
		@IContextKeyService contextKeyService: IContextKeyService,
	) {
		this._ctxHasActiveRequest = CTX_INTERACTIVE_EDITOR_HAS_ACTIVE_REQUEST.bindTo(contextKeyService);
		this._ctxLastEditKind = CTX_INTERACTIVE_EDITOR_LAST_EDIT_KIND.bindTo(contextKeyService);
		this._ctxLastResponseType = CTX_INTERACTIVE_EDITOR_LAST_RESPONSE_TYPE.bindTo(contextKeyService);
		this._ctxLastFeedbackKind = CTX_INTERACTIVE_EDITOR_LAST_FEEDBACK_KIND.bindTo(contextKeyService);
		this._zone = this._store.add(_instaService.createInstance(InteractiveEditorZoneWidget, this._editor));

		this._store.add(this._editor.onDidChangeModel(async e => {
			if (this._activeSession || !e.newModelUrl) {
				return;
			}

			const existingSession = this._interactiveEditorSessionService.getSession(this._editor, e.newModelUrl);
			if (!existingSession) {
				return;
			}

			this._logService.trace('[IE] session RESUMING');
			await this._nextState(State.CREATE_SESSION, { existingSession });
			this._logService.trace('[IE] session done or paused');
		}));
	}

	dispose(): void {
		this._store.dispose();
		this.cancelSession();
	}

	getId(): string {
		return INTERACTIVE_EDITOR_ID;
	}

	getWidgetPosition(): Position | undefined {
		return this._zone.position;
	}

	async run(options: InteractiveEditorRunOptions | undefined): Promise<void> {
		this._logService.trace('[IE] session starting');
		await this._nextState(State.CREATE_SESSION, { ...options });
		this._logService.trace('[IE] session done or paused');
	}

	// ---- state machine

	private async _nextState(state: State, options: InteractiveEditorRunOptions | undefined): Promise<void> {
		this._logService.trace('[IE] setState to ', state);
		let nextState: State | undefined;
		switch (state) {
			case State.CREATE_SESSION:
				nextState = await this._createSession(options);
				break;
			case State.INIT_UI:
				nextState = await this._initUI();
				break;
			case State.WAIT_FOR_INPUT:
				nextState = await this._waitForInput(options);
				break;
			case State.MAKE_REQUEST:
				nextState = await this._makeRequest();
				break;
			case State.APPLY_RESPONSE:
				nextState = await this._applyResponse();
				break;
			case State.SHOW_RESPONSE:
				nextState = await this._showResponse();
				break;
			case State.PAUSE:
				this._pause();
				break;
			case State.DONE:
				this._done();
				break;
		}
		if (nextState) {
			this._nextState(nextState, options);
		}
	}

	private async _createSession(options: InteractiveEditorRunOptions | undefined): Promise<State.DONE | State.INIT_UI> {
		assertType(this._editor.hasModel());

		let session: Session | undefined = options?.existingSession;

		if (!session) {
			const createSessionCts = new CancellationTokenSource();
			const msgListener = Event.once(this._messages.event)(m => {
				this._logService.trace('[IE](state=_createSession) message received', m);
				createSessionCts.cancel();
			});

			session = await this._interactiveEditorSessionService.createSession(
				this._editor,
				{ editMode: this._configurationService.getValue('interactiveEditor.editMode'), wholeRange: options?.initialRange },
				createSessionCts.token
			);

			createSessionCts.dispose();
			msgListener.dispose();
		}

		delete options?.initialRange;
		delete options?.existingSession;

		if (!session) {
			return State.DONE;
		}

		switch (session.editMode) {
			case EditMode.Live:
				this._strategy = this._instaService.createInstance(LiveStrategy, session, this._editor, this._zone.widget);
				break;
			case EditMode.LivePreview:
				this._strategy = this._instaService.createInstance(LivePreviewStrategy, session, this._editor, this._zone.widget);
				break;
			case EditMode.Preview:
				this._strategy = this._instaService.createInstance(PreviewStrategy, session, this._zone.widget);
				break;
		}

		this._activeSession = session;
		return State.INIT_UI;
	}

	private async _initUI(): Promise<State.WAIT_FOR_INPUT | State.SHOW_RESPONSE> {
		assertType(this._activeSession);

		// hide/cancel inline completions when invoking IE
		InlineCompletionsController.get(this._editor)?.hide();

		this._cancelNotebookSiblingEditors();

		this._sessionStore?.dispose();
		this._sessionStore = new DisposableStore();

		const wholeRangeDecoration = this._editor.createDecorationsCollection([{
			range: this._activeSession.wholeRange,
			options: InteractiveEditorController._decoBlock
		}]);
		this._sessionStore.add(toDisposable(() => wholeRangeDecoration.clear()));

		this._zone.widget.updateSlashCommands(this._activeSession.session.slashCommands ?? []);
		this._zone.widget.placeholder = this._activeSession.session.placeholder ?? '';
		this._zone.widget.updateStatus(this._activeSession.session.message ?? localize('welcome.1', "AI-generated code may be incorrect"));
		this._zone.show(this._activeSession.wholeRange.getEndPosition());

		this._sessionStore.add(this._editor.onDidChangeModel(() => {
			this._messages.fire(this._activeSession?.lastExchange
				? Message.PAUSE_SESSION // pause when switching models/tabs and when having a previous exchange
				: Message.END_SESSION
			);
		}));

		this._sessionStore.add(this._editor.onDidChangeModelContent(e => {
			if (!this._ignoreModelContentChanged) {
				this._activeSession!.recordExternalEditOccurred();
			}
		}));

		return this._activeSession.lastExchange
			? State.SHOW_RESPONSE
			: State.WAIT_FOR_INPUT;
	}

	private _cancelNotebookSiblingEditors(): void {
		if (!this._editor.hasModel()) {
			return;
		}
		const candidate = CellUri.parse(this._editor.getModel().uri);
		if (!candidate) {
			return;
		}
		for (const editor of this._notebookEditorService.listNotebookEditors()) {
			if (isEqual(editor.textModel?.uri, candidate.notebook)) {
				let found = false;
				const editors: ICodeEditor[] = [];
				for (const [, codeEditor] of editor.codeEditors) {
					editors.push(codeEditor);
					found = codeEditor === this._editor || found;
				}
				if (found) {
					// found the this editor in the outer notebook editor -> make sure to
					// cancel all sibling sessions
					for (const editor of editors) {
						if (editor !== this._editor) {
							InteractiveEditorController.get(editor)?.cancelSession();

						}
					}
					break;
				}
			}
		}
	}

	private async _waitForInput(options: InteractiveEditorRunOptions | undefined): Promise<State.DONE | State.PAUSE | State.WAIT_FOR_INPUT | State.MAKE_REQUEST> {
		assertType(this._activeSession);

		this._zone.show(this._activeSession.wholeRange.getEndPosition());

		if (options?.message) {
			this._zone.widget.value = options?.message;
			this._zone.widget.selectAll();
			delete options?.message;
		}

		let message = Message.NONE;
		if (options?.autoSend) {
			message = Message.ACCEPT_INPUT;
			delete options?.autoSend;

		} else {
			const barrier = new Barrier();
			const msgListener = Event.once(this._messages.event)(m => {
				this._logService.trace('[IE](state=_waitForInput) message received', m);
				message = m;
				barrier.open();
			});
			await barrier.wait();
			msgListener.dispose();
		}

		this._zone.widget.selectAll();

		if (message & Message.CANCEL_INPUT || message & Message.END_SESSION) {
			return State.DONE;
		}

		if (message & Message.PAUSE_SESSION) {
			return State.PAUSE;
		}

		if (!this._zone.widget.value) {
			return State.WAIT_FOR_INPUT;
		}

		const input = this._zone.widget.value;

		if (!InteractiveEditorController._promptHistory.includes(input)) {
			InteractiveEditorController._promptHistory.unshift(input);
		}

		const refer = this._activeSession.session.slashCommands?.some(value => value.refer && input!.startsWith(`/${value.command}`));
		if (refer) {
			this._logService.info('[IE] seeing refer command, continuing outside editor', this._activeSession.provider.debugName);
			this._editor.setSelection(this._activeSession.wholeRange);
			this._instaService.invokeFunction(sendRequest, input);

			if (!this._activeSession.lastExchange) {
				// DONE when there wasn't any exchange yet. We used the inline chat only as trampoline
				return State.DONE;
			}
			return State.WAIT_FOR_INPUT;
		}

		this._activeSession.addInput(input);
		return State.MAKE_REQUEST;
	}

	private async _makeRequest(): Promise<State.APPLY_RESPONSE | State.PAUSE | State.DONE> {
		assertType(this._editor.hasModel());
		assertType(this._activeSession);
		assertType(this._activeSession.lastInput);

		const requestCts = new CancellationTokenSource();

		let message = Message.NONE;
		const msgListener = Event.once(this._messages.event)(m => {
			this._logService.trace('[IE](state=_makeRequest) message received', m);
			message = m;
			requestCts.cancel();
		});

		const typeListener = this._zone.widget.onDidChangeInput(() => {
			requestCts.cancel();
		});

		const sw = StopWatch.create();
		const request: IInteractiveEditorRequest = {
			prompt: this._activeSession.lastInput,
			selection: this._editor.getSelection(),
			wholeRange: this._activeSession.wholeRange
		};
		const task = this._activeSession.provider.provideResponse(this._activeSession.session, request, requestCts.token);
		this._logService.trace('[IE] request started', this._activeSession.provider.debugName, this._activeSession.session, request);

		let response: EditResponse | MarkdownResponse | ErrorResponse | EmptyResponse;
		let reply: IInteractiveEditorResponse | null | undefined;
		try {
			this._zone.widget.updateProgress(true);
			this._ctxHasActiveRequest.set(true);
			reply = await raceCancellationError(Promise.resolve(task), requestCts.token);

			if (reply?.type === 'message') {
				response = new MarkdownResponse(this._activeSession.textModelN.uri, reply);
			} else if (reply) {
				response = new EditResponse(this._activeSession.textModelN.uri, reply);
			} else {
				response = new EmptyResponse();
			}

		} catch (e) {
			response = new ErrorResponse(e);

		} finally {
			this._ctxHasActiveRequest.set(false);
			this._zone.widget.updateProgress(false);
			this._logService.trace('[IE] request took', sw.elapsed(), this._activeSession.provider.debugName);

		}

		requestCts.dispose();
		msgListener.dispose();
		typeListener.dispose();

		this._activeSession.addExchange(new SessionExchange(request.prompt, response));

		if (message & Message.END_SESSION) {
			return State.DONE;
		} else if (message & Message.PAUSE_SESSION) {
			return State.PAUSE;
		} else {
			return State.APPLY_RESPONSE;
		}
	}

	private async _applyResponse(): Promise<State.SHOW_RESPONSE | State.DONE> {
		assertType(this._activeSession);
		assertType(this._strategy);

		const { response } = this._activeSession.lastExchange!;
		if (response instanceof EditResponse) {
			// edit response -> complex...
			this._zone.widget.updateMarkdownMessage(undefined);

			const canContinue = this._strategy.checkChanges(response);
			if (!canContinue) {
				return State.DONE;
			}
			const moreMinimalEdits = (await this._editorWorkerService.computeHumanReadableDiff(this._activeSession.textModelN.uri, response.localEdits));
			const editOperations = (moreMinimalEdits ?? response.localEdits).map(edit => EditOperation.replace(Range.lift(edit.range), edit.text));
			this._logService.trace('[IE] edits from PROVIDER and after making them MORE MINIMAL', this._activeSession.provider.debugName, response.localEdits, moreMinimalEdits);

			const textModelNplus1 = this._modelService.createModel(createTextBufferFactoryFromSnapshot(this._activeSession.textModelN.createSnapshot()), null, undefined, true);
			textModelNplus1.applyEdits(editOperations);
			const diff = await this._editorWorkerService.computeDiff(this._activeSession.textModel0.uri, textModelNplus1.uri, { ignoreTrimWhitespace: false, maxComputationTimeMs: 5000 }, 'advanced');
			this._activeSession.lastTextModelChanges = diff?.changes ?? [];
			textModelNplus1.dispose();

			try {
				this._ignoreModelContentChanged = true;
				await this._strategy.makeChanges(response, editOperations);
			} finally {
				this._ignoreModelContentChanged = false;
			}
		}

		return State.SHOW_RESPONSE;
	}

	private async _showResponse(): Promise<State.WAIT_FOR_INPUT | State.DONE> {
		assertType(this._activeSession);
		assertType(this._strategy);

		const { response } = this._activeSession.lastExchange!;

		this._ctxLastResponseType.set(response instanceof EditResponse || response instanceof MarkdownResponse
			? response.raw.type
			: undefined);

		if (response instanceof EmptyResponse) {
			// show status message
			this._zone.widget.updateStatus(localize('empty', "No results, please refine your input and try again"), { classes: ['warn'] });
			return State.WAIT_FOR_INPUT;

		} else if (response instanceof ErrorResponse) {
			// show error
			if (!response.isCancellation) {
				this._zone.widget.updateStatus(response.message, { classes: ['error'] });
			}

		} else if (response instanceof MarkdownResponse) {
			// clear status, show MD message
			const renderedMarkdown = renderMarkdown(response.raw.message, { inline: true });
			this._zone.widget.updateStatus('');
			this._zone.widget.updateMarkdownMessage(renderedMarkdown.element);
			this._zone.widget.updateToolbar(true);

		} else if (response instanceof EditResponse) {
			// edit response -> complex...
			this._zone.widget.updateMarkdownMessage(undefined);
			this._zone.widget.updateToolbar(true);

			const canContinue = this._strategy.checkChanges(response);
			if (!canContinue) {
				return State.DONE;
			}

			try {
				this._ignoreModelContentChanged = true;
				await this._strategy.renderChanges(response, this._activeSession.lastTextModelChanges);
			} finally {
				this._ignoreModelContentChanged = false;
			}
		}

		return State.WAIT_FOR_INPUT;
	}

	private async _pause() {
		assertType(this._activeSession);

		this._ctxLastEditKind.reset();
		this._ctxLastResponseType.reset();
		this._ctxLastFeedbackKind.reset();

		this._zone.hide();
		this._editor.focus();

		this._sessionStore?.dispose();
		this._sessionStore = undefined;

		this._strategy?.dispose();
		this._strategy = undefined;
		this._activeSession = undefined;
	}

	private async _done() {
		assertType(this._activeSession);
		this._interactiveEditorSessionService.releaseSession(this._activeSession);
		this._pause();
	}

	// ---- controller API

	accept(): void {
		this._messages.fire(Message.ACCEPT_INPUT);
	}

	cancelCurrentRequest(): void {
		this._messages.fire(Message.CANCEL_INPUT);
		this._messages.fire(Message.CANCEL_REQUEST);
	}

	arrowOut(up: boolean): void {
		if (this._zone.position && this._editor.hasModel()) {
			const { column } = this._editor.getPosition();
			const { lineNumber } = this._zone.position;
			const newLine = up ? lineNumber : lineNumber + 1;
			this._editor.setPosition({ lineNumber: newLine, column });
			this._editor.focus();
		}
	}

	toggleInlineDiff(): void {
		this._strategy?.toggleInlineDiff();
	}

	focus(): void {
		this._zone.widget.focus();
	}

	populateHistory(up: boolean) {
		const len = InteractiveEditorController._promptHistory.length;
		if (len === 0) {
			return;
		}
		const pos = (len + this._historyOffset + (up ? 1 : -1)) % len;
		const entry = InteractiveEditorController._promptHistory[pos];

		this._zone.widget.value = entry;
		this._zone.widget.selectAll();
		this._historyOffset = pos;
	}

	viewInChat() {
		if (this._activeSession?.lastExchange?.response instanceof MarkdownResponse) {
			this._instaService.invokeFunction(showMessageResponse, this._activeSession.lastExchange.prompt, this._activeSession.lastExchange.response.raw.message.value);
		}
	}

	updateExpansionState(expand: boolean) {
		this._zone.widget.updateToggleState(expand);
	}

	undoLast(): string | void {
		if (this._activeSession?.lastExchange?.response instanceof EditResponse) {
			this._activeSession.textModelN.undo();
			return this._activeSession.lastExchange.response.localEdits[0].text;
		}
	}

	feedbackLast(helpful: boolean) {
		if (this._activeSession?.lastExchange?.response instanceof EditResponse || this._activeSession?.lastExchange?.response instanceof MarkdownResponse) {
			const kind = helpful ? InteractiveEditorResponseFeedbackKind.Helpful : InteractiveEditorResponseFeedbackKind.Unhelpful;
			this._activeSession.provider.handleInteractiveEditorResponseFeedback?.(this._activeSession.session, this._activeSession.lastExchange.response.raw, kind);
			this._ctxLastFeedbackKind.set(helpful ? 'helpful' : 'unhelpful');
			this._zone.widget.updateStatus('Thank you for your feedback!', { resetAfter: 1250 });
		}
	}

	createSnapshot(): void {
		if (this._activeSession && !this._activeSession.textModel0.equalsTextBuffer(this._activeSession.textModelN.getTextBuffer())) {
			this._activeSession.createSnapshot();
		}
	}

	async applyChanges(): Promise<EditResponse | void> {
		if (this._strategy) {
			const strategy = this._strategy;
			this._strategy = undefined;
			await strategy?.apply();
			strategy?.dispose();
			this._messages.fire(Message.END_SESSION);

			if (this._activeSession?.lastExchange?.response instanceof EditResponse) {
				return this._activeSession.lastExchange.response;
			}
		}
	}

	async cancelSession() {
		if (this._strategy) {
			const strategy = this._strategy;
			this._strategy = undefined;
			await strategy?.cancel();
			strategy?.dispose();
			this._messages.fire(Message.END_SESSION);
		}
	}
}

async function showMessageResponse(accessor: ServicesAccessor, query: string, response: string) {
	const interactiveSessionService = accessor.get(IInteractiveSessionService);
	const providerId = interactiveSessionService.getProviderInfos()[0]?.id;

	const interactiveSessionWidgetService = accessor.get(IInteractiveSessionWidgetService);
	const widget = await interactiveSessionWidgetService.revealViewForProvider(providerId);
	if (widget && widget.viewModel) {
		interactiveSessionService.addCompleteRequest(widget.viewModel.sessionId, query, { message: response });
		widget.focusLastMessage();
	}
}

async function sendRequest(accessor: ServicesAccessor, query: string) {
	const interactiveSessionService = accessor.get(IInteractiveSessionService);
	const widgetService = accessor.get(IInteractiveSessionWidgetService);

	const providerId = interactiveSessionService.getProviderInfos()[0]?.id;
	const widget = await widgetService.revealViewForProvider(providerId);
	if (!widget) {
		return;
	}

	widget.acceptInput(query);
}
