// Note: This intentinal Modifies the parameters reduces GC.
const arrayToObject = (parameters) => {
    const keyValue = {};
    parameters.forEach((parameter) => {
        const name = parameter.name;
        delete parameter.name;
        keyValue[name] = parameter;
    });
    return keyValue;
}

const decorate = (to, category, object) => {
    to.category = category;
    Object.keys(object).forEach((field) => {
        // skip the 'name' field as it is part of the function prototype
        if (field === 'name') {
            return;
        }
        // commands and events have parameters whereas types have properties
        if (category === 'type' && field === 'properties' ||
            field === 'parameters') {
            to[field] = arrayToObject(object[field]);
        } else {
            to[field] = object[field];
        }
    });
}

const addCommand = (chromium, domainName, command) => {
    const commandName = `${domainName}.${command.name}`;
    const handler = (params, sessionId, callback) => {
        return chromium.send(commandName, params, sessionId, callback);
    };
    decorate(handler, 'command', command);
    chromium[commandName] = chromium[domainName][command.name] = handler;
};

const addEvent = (chromium, domainName, event) => {
    const eventName = `${domainName}.${event.name}`;
    const handler = (sessionId, handler) => {
        if (typeof sessionId === 'function') {
            handler = sessionId;
            sessionId = undefined;
        }
        const rawEventName = sessionId ? `${eventName}.${sessionId}` : eventName;
        if (typeof handler === 'function') {
            chromium.on(rawEventName, handler);
            return () => chromium.removeListener(rawEventName, handler);
        } else {
            return new Promise((fulfill, reject) => {
                chromium.once(rawEventName, fulfill);
            });
        }
    };
    decorate(handler, 'event', event);
    chromium[eventName] = chromium[domainName][event.name] = handler;
};

const addType = (chromium, domainName, type) => {
    const typeName = `${domainName}.${type.id}`;
    const help = {};
    decorate(help, 'type', type);
    chromium[typeName] = chromium[domainName][type.id] = help;
};
// assign the protocol and generate the shorthands
const prepare = (object, protocol) => 
  (object.protocol = protocol) && protocol.domains.forEach((domain) => {
    const domainName = domain.domain;
    object[domainName] = {};
    
    [].concat(domain.commands).forEach((command) => addCommand(object, domainName, command) );
    [].concat(domain.events).forEach((event) => addEvent(object, domainName, event) );
    [].concat(domain.types).forEach((type) => addType(object, domainName, type) );
    
    object[domainName].on = (eventName, handler) => object[domainName][eventName](handler);
  });
