/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from 'vs/base/common/event';
import { IDisposable } from 'vs/base/common/lifecycle';
import 'vs/css!./interactiveEditor';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { IBulkEditService } from 'vs/editor/browser/services/bulkEditService';
import { EditOperation, ISingleEditOperation } from 'vs/editor/common/core/editOperation';
import { Position } from 'vs/editor/common/core/position';
import { Range } from 'vs/editor/common/core/range';
import { Selection } from 'vs/editor/common/core/selection';
import { LineRangeMapping } from 'vs/editor/common/diff/linesDiffComputer';
import { IEditorDecorationsCollection } from 'vs/editor/common/editorCommon';
import { ICursorStateComputer, IModelDecorationOptions, IModelDeltaDecoration, IValidEditOperation } from 'vs/editor/common/model';
import { IEditorWorkerService } from 'vs/editor/common/services/editorWorker';
import { localize } from 'vs/nls';
import { IContextKey, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { InteractiveEditorFileCreatePreviewWidget, InteractiveEditorLivePreviewWidget } from 'vs/workbench/contrib/interactiveEditor/browser/interactiveEditorLivePreviewWidget';
import { EditResponse, Session } from 'vs/workbench/contrib/interactiveEditor/browser/interactiveEditorSession';
import { InteractiveEditorWidget } from 'vs/workbench/contrib/interactiveEditor/browser/interactiveEditorWidget';
import { getValueFromSnapshot } from 'vs/workbench/contrib/interactiveEditor/browser/utils';
import { CTX_INTERACTIVE_EDITOR_INLNE_DIFF, CTX_INTERACTIVE_EDITOR_DOCUMENT_CHANGED } from 'vs/workbench/contrib/interactiveEditor/common/interactiveEditor';

export abstract class EditModeStrategy {

	dispose(): void { }

	abstract checkChanges(response: EditResponse): boolean;

	abstract apply(): Promise<void>;

	abstract cancel(): Promise<void>;

	abstract makeChanges(response: EditResponse, edits: ISingleEditOperation[]): Promise<void>;

	abstract renderChanges(response: EditResponse, changes: LineRangeMapping[]): Promise<void>;

	abstract hide(): Promise<void>;

	abstract toggleInlineDiff(): void;
}

export class PreviewStrategy extends EditModeStrategy {

	private readonly _ctxDocumentChanged: IContextKey<boolean>;
	private readonly _listener: IDisposable;

	constructor(
		private readonly _session: Session,
		private readonly _widget: InteractiveEditorWidget,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IBulkEditService private readonly _bulkEditService: IBulkEditService,
	) {
		super();

		this._ctxDocumentChanged = CTX_INTERACTIVE_EDITOR_DOCUMENT_CHANGED.bindTo(contextKeyService);
		this._listener = Event.debounce(_session.textModelN.onDidChangeContent.bind(_session.textModelN), () => { }, 350)(_ => {
			this._ctxDocumentChanged.set(!_session.textModelN.equalsTextBuffer(_session.textModel0.getTextBuffer()));
		});
	}

	override dispose(): void {
		this._listener.dispose();
		this._ctxDocumentChanged.reset();
		super.dispose();
	}

	checkChanges(response: EditResponse): boolean {
		if (!response.workspaceEdits || response.singleCreateFileEdit) {
			// preview stategy can handle simple workspace edit (single file create)
			return true;
		}
		this._bulkEditService.apply(response.workspaceEdits, { showPreview: true });
		return false;
	}

	async apply() {

		if (!(this._session.lastExchange?.response instanceof EditResponse)) {
			return;
		}
		const editResponse = this._session.lastExchange?.response;
		if (editResponse.workspaceEdits) {
			await this._bulkEditService.apply(editResponse.workspaceEdits);

		} else if (!editResponse.workspaceEditsIncludeLocalEdits) {

			const { textModelN: modelN } = this._session;

			if (modelN.equalsTextBuffer(this._session.textModel0.getTextBuffer())) {
				modelN.pushStackElement();
				const edits = editResponse.localEdits.map(edit => EditOperation.replace(Range.lift(edit.range), edit.text));
				modelN.pushEditOperations(null, edits, () => null);
				modelN.pushStackElement();
			}
		}
	}

	override async hide(): Promise<void> {
		// nothing to do, input widget will be hidden by controller
	}

	async cancel(): Promise<void> {
		// nothing to do
	}

	override async makeChanges(_response: EditResponse, _edits: ISingleEditOperation[]): Promise<void> {
		// nothing to do
	}

	override async renderChanges(response: EditResponse, changes: LineRangeMapping[]): Promise<void> {
		if (response.localEdits.length > 0) {
			const edits = response.localEdits.map(edit => EditOperation.replace(Range.lift(edit.range), edit.text));
			this._widget.showEditsPreview(this._session.textModel0, edits, changes);
		} else {
			this._widget.hideEditsPreview();
		}

		if (response.singleCreateFileEdit) {
			this._widget.showCreatePreview(response.singleCreateFileEdit.uri, await Promise.all(response.singleCreateFileEdit.edits));
		} else {
			this._widget.hideCreatePreview();
		}
	}

	toggleInlineDiff(): void { }
}

class InlineDiffDecorations {

	private readonly _collection: IEditorDecorationsCollection;

	private _data: { tracking: IModelDeltaDecoration; decorating: IModelDecorationOptions }[] = [];
	private _visible: boolean = false;

	constructor(editor: ICodeEditor, visible: boolean = false) {
		this._collection = editor.createDecorationsCollection();
		this._visible = visible;
	}

	get visible() {
		return this._visible;
	}

	set visible(value: boolean) {
		this._visible = value;
		this.update();
	}

	clear() {
		this._collection.clear();
		this._data.length = 0;
	}

	collectEditOperation(op: IValidEditOperation) {
		this._data.push(InlineDiffDecorations._asDecorationData(op));
	}

	update() {
		this._collection.set(this._data.map(d => {
			const res = { ...d.tracking };
			if (this._visible) {
				res.options = { ...res.options, ...d.decorating };
			}
			return res;
		}));
	}

	private static _asDecorationData(edit: IValidEditOperation): { tracking: IModelDeltaDecoration; decorating: IModelDecorationOptions } {
		let content = edit.text;
		if (content.length > 12) {
			content = content.substring(0, 12) + '…';
		}
		const tracking: IModelDeltaDecoration = {
			range: edit.range,
			options: {
				description: 'interactive-editor-inline-diff',
			}
		};

		const decorating: IModelDecorationOptions = {
			description: 'interactive-editor-inline-diff',
			className: !edit.range.isEmpty() ? 'interactive-editor-lines-inserted-range' : undefined,
			showIfCollapsed: true,
			before: {
				content,
				inlineClassName: 'interactive-editor-lines-deleted-range-inline',
				attachedData: edit,
			}
		};

		return { tracking, decorating };
	}
}

export class LiveStrategy extends EditModeStrategy {

	private static _inlineDiffStorageKey: string = 'interactiveEditor.storage.inlineDiff';
	private _inlineDiffEnabled: boolean = false;

	private readonly _inlineDiffDecorations: InlineDiffDecorations;
	private readonly _ctxInlineDiff: IContextKey<boolean>;
	private _lastResponse?: EditResponse;

	constructor(
		protected readonly _session: Session,
		protected readonly _editor: ICodeEditor,
		protected readonly _widget: InteractiveEditorWidget,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IStorageService protected _storageService: IStorageService,
		@IBulkEditService protected readonly _bulkEditService: IBulkEditService,
		@IEditorWorkerService protected readonly _editorWorkerService: IEditorWorkerService,
	) {
		super();
		this._inlineDiffDecorations = new InlineDiffDecorations(this._editor, this._inlineDiffEnabled);
		this._ctxInlineDiff = CTX_INTERACTIVE_EDITOR_INLNE_DIFF.bindTo(contextKeyService);

		this._inlineDiffEnabled = _storageService.getBoolean(LiveStrategy._inlineDiffStorageKey, StorageScope.PROFILE, false);
		this._ctxInlineDiff.set(this._inlineDiffEnabled);
		this._inlineDiffDecorations.visible = this._inlineDiffEnabled;
	}

	override dispose(): void {
		this._inlineDiffEnabled = this._inlineDiffDecorations.visible;
		this._storageService.store(LiveStrategy._inlineDiffStorageKey, this._inlineDiffEnabled, StorageScope.PROFILE, StorageTarget.USER);
		this._inlineDiffDecorations.clear();
		this._ctxInlineDiff.reset();

		super.dispose();
	}

	toggleInlineDiff(): void {
		this._inlineDiffEnabled = !this._inlineDiffEnabled;
		this._ctxInlineDiff.set(this._inlineDiffEnabled);
		this._inlineDiffDecorations.visible = this._inlineDiffEnabled;
		this._storageService.store(LiveStrategy._inlineDiffStorageKey, this._inlineDiffEnabled, StorageScope.PROFILE, StorageTarget.USER);
	}

	checkChanges(response: EditResponse): boolean {
		this._lastResponse = response;
		if (response.singleCreateFileEdit) {
			// preview stategy can handle simple workspace edit (single file create)
			return true;
		}
		if (response.workspaceEdits) {
			this._bulkEditService.apply(response.workspaceEdits, { showPreview: true });
			return false;
		}
		return true;
	}

	async apply() {
		if (this._lastResponse?.workspaceEdits) {
			await this._bulkEditService.apply(this._lastResponse.workspaceEdits);
		}
	}

	override async hide(): Promise<void> {
		this._inlineDiffDecorations.clear();
	}

	async cancel() {
		const { textModelN: modelN, textModel0: model0, lastSnapshot } = this._session;
		if (modelN.isDisposed() || (model0.isDisposed() && !lastSnapshot)) {
			return;
		}

		const newText = lastSnapshot
			? getValueFromSnapshot(lastSnapshot)
			: model0.getValue();

		const edits = await this._editorWorkerService.computeMoreMinimalEdits(modelN.uri, [{ range: modelN.getFullModelRange(), text: newText }]);
		if (edits) {
			const operations = edits.map(e => EditOperation.replace(Range.lift(e.range), e.text));
			modelN.pushEditOperations(null, operations, () => null);
		}
	}

	override async makeChanges(_response: EditResponse, edits: ISingleEditOperation[]): Promise<void> {
		const cursorStateComputerAndInlineDiffCollection: ICursorStateComputer = (undoEdits) => {
			let last: Position | null = null;
			for (const edit of undoEdits) {
				last = !last || last.isBefore(edit.range.getEndPosition()) ? edit.range.getEndPosition() : last;
				this._inlineDiffDecorations.collectEditOperation(edit);
			}
			return last && [Selection.fromPositions(last)];
		};

		this._editor.pushUndoStop();
		this._editor.executeEdits('interactive-editor-live', edits, cursorStateComputerAndInlineDiffCollection);
		this._editor.pushUndoStop();
	}

	override async renderChanges(response: EditResponse, textModel0Changes: LineRangeMapping[]) {

		this._inlineDiffDecorations.update();
		this._updateSummaryMessage(textModel0Changes);

		if (response.singleCreateFileEdit) {
			this._widget.showCreatePreview(response.singleCreateFileEdit.uri, await Promise.all(response.singleCreateFileEdit.edits));
		} else {
			this._widget.hideCreatePreview();
		}
	}

	protected _updateSummaryMessage(textModel0Changes: LineRangeMapping[]) {
		let linesChanged = 0;
		if (textModel0Changes) {
			for (const change of textModel0Changes) {
				linesChanged += change.changedLineCount;
			}
		}
		let message: string;
		if (linesChanged === 0) {
			message = localize('lines.0', "Generated reply");
		} else if (linesChanged === 1) {
			message = localize('lines.1', "Generated reply and changed 1 line");
		} else {
			message = localize('lines.N', "Generated reply and changed {0} lines", linesChanged);
		}
		this._widget.updateStatus(message);
	}
}

export class LivePreviewStrategy extends LiveStrategy {

	private readonly _diffZone: InteractiveEditorLivePreviewWidget;
	private readonly _previewZone: InteractiveEditorFileCreatePreviewWidget;

	constructor(
		session: Session,
		editor: ICodeEditor,
		widget: InteractiveEditorWidget,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IStorageService storageService: IStorageService,
		@IBulkEditService bulkEditService: IBulkEditService,
		@IEditorWorkerService editorWorkerService: IEditorWorkerService,
		@IInstantiationService instaService: IInstantiationService,
	) {
		super(session, editor, widget, contextKeyService, storageService, bulkEditService, editorWorkerService);

		this._diffZone = instaService.createInstance(InteractiveEditorLivePreviewWidget, editor, session.textModel0);
		this._previewZone = instaService.createInstance(InteractiveEditorFileCreatePreviewWidget, editor);
	}

	override dispose(): void {
		this._diffZone.hide();
		this._diffZone.dispose();
		this._previewZone.hide();
		this._previewZone.dispose();
		super.dispose();
	}

	override async hide(): Promise<void> {
		this._diffZone.hide();
		super.hide();
	}

	override async makeChanges(_response: EditResponse, edits: ISingleEditOperation[]): Promise<void> {
		this._editor.pushUndoStop();
		this._editor.executeEdits('interactive-editor-livePreview', edits);
		this._editor.pushUndoStop();
	}

	override async renderChanges(response: EditResponse, changes: LineRangeMapping[]) {

		this._diffZone.showDiff(() => this._session.wholeRange, changes);
		this._updateSummaryMessage(changes);

		if (response.singleCreateFileEdit) {
			this._previewZone.showCreation(this._session.wholeRange, response.singleCreateFileEdit.uri, await Promise.all(response.singleCreateFileEdit.edits));
		} else {
			this._previewZone.hide();
		}
	}
}
