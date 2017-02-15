// Copyright 2017 Intel Corporation
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var device = require('iotivity-node'),
    debuglog = require('util').debuglog('ambient_light'),
    illuminanceResource,
    sensorPin,
    notifyObserversTimeoutId,
    exitId,
    resourceTypeName = 'oic.r.sensor.illuminance',
    resourceInterfaceName = '/a/illuminance',
    hasUpdate = false,
    observerCount = 0,
    lux = 0.0;

// Require the MRAA library
var mraa = '';
try {
    mraa = require('mraa');
    if(mraa.adcSupportedBits() == 0 ){
        mraa.Aio =  require('./helper-function/mraa_MinnowBoard_ADC.js').Aio;
    }    
}
catch (e) {
    debuglog('No mraa module: ', e.message);
}

// Setup ambient light sensor pin.
function setupHardware() {
    if (!mraa)
        return;

    sensorPin = new mraa.Aio(3);
}

// This function construct the payload and returns when
// the GET request received from the client.
function getProperties() {
    var temp = 0;
    if (mraa) {
        var raw_value = sensorPin.read();

        // Conversion to lux
        temp = 10000.0 / Math.pow(((1023.0 - raw_value) * 10.0 / raw_value) * 15.0, 4.0 / 3.0);
    } else {
        // Simulate real sensor behavior. This is
        // useful for testing on desktop without mraa.
        temp = lux + 0.1;
    }

    var illuminance = Math.round(temp * 100) / 100;
    if (lux != illuminance) {
        lux = illuminance;
        hasUpdate = true;
    }

    // Format the payload.
    var properties = {
        rt: resourceTypeName,
        id: 'illuminance',
        illuminance: lux
    };

    return properties;
}

// Set up the notification loop
function notifyObservers() {
    properties = getProperties();

    notifyObserversTimeoutId = null;
    if (hasUpdate) {
        illuminanceResource.properties = properties;
        hasUpdate = false;

        debuglog('Send the lux value: ', lux);
        illuminanceResource.notify().catch(
            function(error) {
                debuglog('Failed to notify observers: ', error);
                if (error.observers.length === 0) {
                    observerCount = 0;
                    if (notifyObserversTimeoutId) {
                        clearTimeout(notifyObserversTimeoutId);
                        notifyObserversTimeoutId = null;
                    }
                }
            });
    }

    // After all our clients are complete, we don't care about any
    // more requests to notify.
    if (observerCount > 0) {
        notifyObserversTimeoutId = setTimeout(notifyObservers, 2000);
    }
}

function retrieveHandler(request) {
    illuminanceResource.properties = getProperties();
    request.respond(illuminanceResource).catch(handleError);

    if ('observe' in request) {
        hasUpdate = true;
        observerCount += request.observe ? 1 : -1;
        if (!notifyObserversTimeoutId && observerCount > 0)
            setTimeout(notifyObservers, 200);
    }
}

device.device = Object.assign(device.device, {
    name: 'Smart Home Illuminance Sensor',
    coreSpecVersion: 'core.1.1.0',
    dataModels: ['res.1.1.0']
});

function handleError(error) {
    debuglog('Failed to send response with error: ', error);
}

device.platform = Object.assign(device.platform, {
    manufacturerName: 'Intel',
    manufactureDate: new Date('Fri Oct 30 10:04:17 (EET) 2015'),
    platformVersion: '1.1.0',
    firmwareVersion: '0.0.1'
});

if (device.device.uuid) {
    // Setup Illuminance sensor pin.
    setupHardware();

    debuglog('Create Illuminance sensor resource.');

    // Register illuminance resource
    device.server.register({
        resourcePath: resourceInterfaceName,
        resourceTypes: [resourceTypeName],
        interfaces: ['oic.if.baseline'],
        discoverable: true,
        observable: true,
        properties: getProperties()
    }).then(
        function(resource) {
            debuglog('register() resource successful');
            illuminanceResource = resource;

            // Add event handlers for each supported request type
            resource.onretrieve(retrieveHandler);
        },
        function(error) {
            debuglog('register() resource failed with: ', error);
        });
}

// Cleanup when interrupted
function exitHandler() {
    debuglog('Delete Illuminance sensor Resource.');

    if (exitId)
        return;

    // Unregister resource.
    illuminanceResource.unregister().then(
        function() {
            debuglog('unregister() resource successful');
        },
        function(error) {
            debuglog('unregister() resource failed with: ', error);
        });

    // Exit
    exitId = setTimeout(function() { process.exit(0); }, 1000);
}

// Exit gracefully
process.on('SIGINT', exitHandler);
process.on('SIGTERM', exitHandler);
