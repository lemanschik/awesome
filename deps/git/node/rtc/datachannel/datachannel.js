import require$$1 from 'readable-stream';
import require$$1$1 from 'is-stream';
import require$$2 from 'binary-data';
import require$$0 from 'assert';

const messageType = {
  DATA_CHANNEL_ACK: 0x02,
  DATA_CHANNEL_OPEN: 0x03,
};

const channelType$2 = {
  DATA_CHANNEL_RELIABLE: 0x00,
  DATA_CHANNEL_RELIABLE_UNORDERED: 0x80,
  DATA_CHANNEL_PARTIAL_RELIABLE_REXMIT: 0x01,
  DATA_CHANNEL_PARTIAL_RELIABLE_REXMIT_UNORDERED: 0x81,
  DATA_CHANNEL_PARTIAL_RELIABLE_TIMED: 0x02,
  DATA_CHANNEL_PARTIAL_RELIABLE_TIMED_UNORDERED: 0x82,
};

var constants = {
  messageType,
  channelType: channelType$2,
};

const {
  types: { uint8, uint16be, uint32be, string },
} = require$$2;

const Open = {
  messageType: uint8,
  channelType: uint8,
  priority: uint16be,
  reliability: uint32be,
  labelLength: uint16be,
  protocolLength: uint16be,
  label: string(({ current }) => current.labelLength),
  protocol: string(({ current }) => current.protocolLength),
};

const Act = uint8;

var protocol$2 = {
  Open,
  Act,
};

const assert = require$$0;
const { Transform } = require$$1;
const { decode } = require$$2;
const {
  messageType: { DATA_CHANNEL_ACK: DATA_CHANNEL_ACK$1, DATA_CHANNEL_OPEN: DATA_CHANNEL_OPEN$1 },
} = constants;
const protocol$1 = protocol$2;

const STATE_INIT = 'init';
const STATE_OPENING = 'open';
const STATE_ACK = 'ack';
const STATE_FINISHED = 'finished';

const _negotiated$1 = Symbol('negotiated');
const _state = Symbol('state');

/**
 * Simple state machine to process webrtc datachannel handshake.
 */
class HandshakeMachine$1 extends Transform {
  /**
   * @class HandshakeMachine
   * @param {boolean} negotiated
   */
  constructor(negotiated) {
    super();

    this[_state] = STATE_INIT;
    this[_negotiated$1] = negotiated;
  }

  /**
   * Check is channel ready.
   */
  get ready() {
    return this.state === STATE_FINISHED;
  }

  /**
   * Switch to 'opening' state.
   */
  opening() {
    this[_state] = STATE_OPENING;

    // Suggest to send `OPEN` message
    this.emit('postopen');
  }

  /**
   * Process an arrived message.
   * @private
   * @param {Buffer} message Arrived message.
   */
  _handshake(message) {
    if (this[_negotiated$1]) {
      /**
       * The channel should wait for OPEN message
       * and respond with ACK one.
       */
      if (message.length < 12) {
        throw new Error('invalid handshake');
      }

      if (message[0] !== DATA_CHANNEL_OPEN$1) {
        throw new Error('Unexpected message');
      }

      const packet = decode(message, protocol$1.Open);

      // Notify an uppen layer about `Open` message
      this.emit('handshake', packet);

      // Suggest to send `ACK` message
      this.emit('postack');

      this[_state] = STATE_FINISHED;
      this.emit('final');
    } else {
      /**
       * The channel should send Open message at the start
       * and wait for ACK message.
       */
      assert(
        this.state,
        STATE_OPENING,
        'Unexpected state: you should send `Open` message before'
      );

      const isAck = message.length === 1 && message[0] === DATA_CHANNEL_ACK$1;

      if (!isAck) {
        throw new Error('Invalid handshake');
      }

      this[_state] = STATE_FINISHED;
      this.emit('final');
    }
  }

  /**
   * @private
   * @param {Buffer} chunk
   * @param {string} encoding
   * @param {Function} callback
   */
  _transform(chunk, encoding, callback) {
    if (encoding !== 'buffer') {
      callback(new TypeError('Invalid chunk'));
      return;
    }

    let currentError = null;

    if (this.ready) {
      this.push(chunk);
    } else {
      try {
        this._handshake(chunk);
      } catch (error) {
        currentError = error;
      }
    }

    callback(currentError);
  }

  /**
   * Get the current state.
   */
  get state() {
    return this[_state];
  }
}

var handshake = {
  HandshakeMachine: HandshakeMachine$1,
  constants: {
    STATE_INIT,
    STATE_OPENING,
    STATE_ACK,
    STATE_FINISHED,
  },
};

const { Duplex, pipeline, finished } = require$$1;
const { readable: isReadable, writable: isWritable } = require$$1$1;
const { encode, createEncodeStream } = require$$2;
export const { HandshakeMachine } = handshake;
const {
  messageType: { DATA_CHANNEL_ACK, DATA_CHANNEL_OPEN },
  channelType: channelType$1,
} = constants;
const protocol = protocol$2;

const _handshake = Symbol('handshake');
const _label = Symbol('label');
const _priority = Symbol('priority');
const _reliability = Symbol('reliability');
const _input = Symbol('input');
const _output = Symbol('output');
const _protocol = Symbol('protocol');
const _channelType = Symbol('channelType');
const _negotiated = Symbol('negotiated');
const _closed = Symbol('closed');

const MESSAGE_ACK = Buffer.allocUnsafe(1);
MESSAGE_ACK[0] = DATA_CHANNEL_ACK;

/**
 * This class implements WebRTC DataChannel interface.
 * It holds in/out sctp streams and channel metadata.
 */
var channel = class Channel extends Duplex {
  /**
   * @class Channel
   * @param {Object} options
   * @param {stream.Readable} options.input
   * @param {stream.Writable} options.output
   * @param {number} options.channelType
   * @param {string} [options.label]
   * @param {string} [options.protocol]
   * @param {number} [options.priority]
   * @param {number} [options.reliability]
   * @param {boolean} [options.negotiated = false]
   */
  constructor(options) {
    super();

    if (!isReadable(options.input) || !isWritable(options.output)) {
      throw new Error('Invalid input or output stream');
    }

    this[_label] = '';
    this[_input] = options.input;
    this[_output] = options.output;
    this[_reliability] = 0;
    this[_priority] = 0;
    this[_protocol] = '';
    this[_channelType] = options.channelType;
    this[_negotiated] = false;
    this[_closed] = false;

    if (typeof options.label === 'string') {
      if (options.label.length > 0xffff) {
        throw new TypeError('Invalid label name');
      }

      this[_label] = options.label;
    }

    if (typeof options.protocol === 'string') {
      if (options.protocol.length > 0xffff) {
        throw new TypeError('Invalid protocol name');
      }

      this[_protocol] = options.protocol;
    }

    if (Number.isInteger(options.reliability)) {
      this[_reliability] = options.reliability;
    }

    if (isPriority(options.priority)) {
      this[_priority] = options.priority;
    }

    if (typeof options.negotiated === 'boolean') {
      this[_negotiated] = options.negotiated;
    }

    const handshake = new HandshakeMachine(this[_negotiated]);
    this[_handshake] = handshake;

    let readableClosed = false;
    let writableClosed = false;
    const maybeClose = () => {
      if (readableClosed && writableClosed && !this[_closed]) {
        this.close();
      }
    };

    pipeline(this[_input], handshake, err => {
      if (err) {
        this.emit('error', err);
      }

      readableClosed = true;
      maybeClose();
    });

    finished(this[_output], err => {
      if (err) {
        this.emit('error', err);
      }

      writableClosed = true;
      maybeClose();
    });

    handshake.on('data', data => this.push(data));

    handshake.once('final', () => {
      this.emit('open');
    });

    handshake.once('postopen', () => {
      const packet = {
        messageType: DATA_CHANNEL_OPEN,
        channelType: this.type,
        priority: this.priority,
        reliability: this[_reliability],
        labelLength: this.label.length,
        protocolLength: this.protocol.length,
        label: this.label,
        protocol: this.protocol,
      };

      const outstream = createEncodeStream();

      encode(packet, outstream, protocol.Open);
      options.output.write(outstream.slice());
    });

    handshake.once('postack', () => {
      options.output.write(MESSAGE_ACK);
    });

    handshake.once('handshake', packet => {
      this[_label] = packet.label;
      this[_protocol] = packet.protocol;
      this[_priority] = packet.priority;
      this[_channelType] = packet.channelType;
      this[_reliability] = packet.reliability;
    });

    if (!this[_negotiated]) {
      process.nextTick(() => {
        this[_handshake].opening();
      });
    }
  }

  /**
   * The name of the Data Channel.
   * @returns {string}
   */
  get label() {
    return this[_label];
  }

  /**
   * The priority of the Data Channel.
   * @returns {number}
   */
  get priority() {
    return this[_priority];
  }

  /**
   * The name of a protocol registered in the 'WebSocket Subprotocol Name Registry'.
   * @returns {string}
   */
  get protocol() {
    return this[_protocol];
  }

  /**
   * Get the channel type.
   * @returns {number}
   */
  get type() {
    return this[_channelType];
  }

  /**
   * Get the type of the delivery.
   * @returns {boolean}
   */
  get ordered() {
    return (
      this.type === channelType$1.DATA_CHANNEL_RELIABLE ||
      this.type === channelType$1.DATA_CHANNEL_PARTIAL_RELIABLE_TIMED ||
      this.type === channelType$1.DATA_CHANNEL_PARTIAL_RELIABLE_REXMIT
    );
  }

  /**
   * Returns true if the Data Channel was negotiated by
   * the application, or false otherwise.
   * @returns {boolean}
   */
  get negotiated() {
    return this[_negotiated];
  }

  /**
   * For reliable Data Channels this field MUST be set to 0 on the
   * sending side and MUST be ignored on the receiving side.  If a
   * partial reliable Data Channel with limited number of
   * retransmissions is used, this field specifies the number of
   * retransmissions.  If a partial reliable Data Channel with limited
   * lifetime is used, this field specifies the maximum lifetime in
   * milliseconds.
   * @returns {number}
   */
  get reliability() {
    return this[_reliability];
  }

  /**
   * @private
   */
  _read() {} // eslint-disable-line class-methods-use-this

  /**
   * @private
   * @param {string|Buffer} chunk
   * @param {string} encoding
   * @param {Function} callback
   */
  _write(chunk, encoding, callback) {
    if (this[_handshake].ready) {
      this[_output].write(chunk, encoding, callback);
    } else {
      this[_handshake].once('final', () => {
        this[_output].write(chunk, encoding, callback);
      });
    }
  }

  /**
   * @private
   * @param {Error} err
   * @param {Function} callback
   */
  _destroy(err, callback) {
    this.close();
    callback();
  }

  /**
   * Closes the channel.
   */
  close() {
    if (this[_closed]) {
      return;
    }

    this[_closed] = true;
    this.emit('close');
  }
};

/**
 * Check if argument is valid priority.
 * @param {number} priority
 * @returns {boolean}
 */
function isPriority(priority) {
  return [0, 128, 256, 512, 1024].includes(priority);
}

const Channel = channel;
export const { channelType } = constants;

var src = {
  createChannel,
};

/**
 * Creates the Data Channel.
 * @param {Object} options
 * @param {stream.Readable} options.input
 * @param {stream.Writable} options.output
 * @param {boolean} [options.negotiated = false]
 * @param {string} [options.label]
 * @param {string} [options.protocol]
 * @param {number} [options.priority]
 * @param {boolean} [options.ordered] The type of the delivery.
 * @param {number} [options.retries] The number of retransmissions.
 * @param {number} [options.lifetime] The maximum lifetime in milliseconds.
 * @returns {Channel}
 */
export function createChannel(options = {}) {
  const { ordered, retries, lifetime } = options;

  return new Channel({
    ...options,
    channelType: createChannelType(ordered, retries, lifetime),
    reliability: createReliability(retries, lifetime),
  });
}

/**
 * Creates a valid channel type for provided parameters.
 * @param {boolean} ordered The type of the delivery.
 * @param {number} [retries] The number of retransmissions.
 * @param {number} [lifetime] The maximum lifetime in milliseconds.
 * @returns {number}
 */
function createChannelType(ordered, retries, lifetime) {
  if (Number.isInteger(retries) && Number.isInteger(lifetime)) {
    throw new TypeError('You cannot set both `retries` and `lifetime`');
  }

  if (ordered) {
    if (Number.isInteger(retries)) {
      return channelType.DATA_CHANNEL_PARTIAL_RELIABLE_REXMIT;
    }

    if (Number.isInteger(lifetime)) {
      return channelType.DATA_CHANNEL_PARTIAL_RELIABLE_TIMED;
    }

    return channelType.DATA_CHANNEL_RELIABLE;
  }

  if (Number.isInteger(retries)) {
    return channelType.DATA_CHANNEL_PARTIAL_RELIABLE_REXMIT_UNORDERED;
  }

  if (Number.isInteger(lifetime)) {
    return channelType.DATA_CHANNEL_PARTIAL_RELIABLE_TIMED_UNORDERED;
  }

  return channelType.DATA_CHANNEL_RELIABLE_UNORDERED;
}

/**
 * Get `reliability` attribute value.
 * @param {number} [retries] The number of retransmissions.
 * @param {number} [lifetime] The maximum lifetime in milliseconds.
 * @returns {number}
 */
function createReliability(retries, lifetime) {
  if (Number.isInteger(retries)) {
    return retries;
  }

  if (Number.isInteger(lifetime)) {
    return lifetime;
  }

  return 0;
}

export { src as default };
