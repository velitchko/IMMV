let mongoose = require('mongoose');
// NOTE: Import locally for some reason it doesnt work when importing from the data_schemes
let EventSchema = require('./event');
let LocationSchema = require('./location');
let axios = require('axios');
let throttledQueue = require('throttled-queue');
let cli = require('cli-progress');

let db = require('../data_schemes/db.config');

const api_token = '87a158b71e76a7';
const progressBar = new cli.Bar({}, cli.Presets.shades_classic);
let results = [];

let throttle = throttledQueue(1, 1000);
mongoose.set('debug', true);
mongoose.set('useNewUrlParser', true);
mongoose.connect(`mongodb://localhost:27017/${db.collectionName}`, function (err) {
    console.log('DB Connected');
    console.log(`mongodb://localhost:27017/${db.collectionName}`);
    if (err) {
        console.log(err);
        return;
    }
    // findEvents();
    findLocations();
});

function findLocations() {
    LocationSchema.find({}, (err, locations) => {
        let queued = locations.length;
        progressBar.start(queued, 0);
        if (err) {
            console.log(err);
            return;
        }
        for(let i = 0; i < locations.length; i++) {
            let location = locations[i];
            throttle(async function () {
                if (location.geodata) {
                    for(let j = 0; j < location.geodata.length; j++) {
                        let geodata = location.geodata[j];
                        if((!geodata.lat || !geodata.lng) && (geodata.lat === 0 || geodata.lng === 0)) {
                            let result = await geocode(geodata, location._id.toString(), geodata._id.toString());
                            results.push(result);
                        }
                    }
                }
                // console.log('result pushed');
                queued -= 1;
                progressBar.increment();

                // console.log(result);        
                if (queued === 0) {
                    console.log('done with queue');
                    progressBar.stop();
                    saveLocationResults();
                }
            });
        }
    });
}


async function geocode(location, objectID, geodataID = null) {
    let query = encodeURIComponent(`${location.streetName} ${location.streetNumber}, ${location.districtNumber} Vienna`);
    let uri = `https://eu1.locationiq.com/v1/search.php?key=${api_token}&q=${query}&format=json&limit=1`;
    try {
        let result = await axios.get(uri);
        return {
            object: objectID,
            geodata: geodataID,
            lat: result.data[0].lat,
            lng: result.data[0].lon
        };
    } catch (error) {
        console.log(`STATUS: ${error.response.status} | ${error.response.statusText}`);
        return null;
    }
    // console.log(result);
    // return result.data;
}

function findEvents() {
    //  name: { $regex: 'festwochen', $options: 'i' }, geodata: {$exists: true}
    EventSchema.find({}, function (err, events) {
        let queued = events.length;
        progressBar.start(queued, 0);
        if (err) {
            console.log(err);
            return;
        }

        // console.log(`${events.length} events found`);
        for (let i = 0; i < events.length; i++) {
            let event = events[i];

            throttle(async function () {
                // If we have geodata with a streetname and lat / lng doesnt exist or is 0
                if (event.geodata && 
                    event.geodata.streetName && 
                    ((!event.geodata.lat || !event.geodata.lng) || 
                    (event.geodata.lat === 0 || event.geodata.lng === 0))) {
                    let result = await geocode(event.geodata, event._id.toString());
                    if (result) {
                        results.push(result);
                    }
                }
                // console.log('result pushed');
                queued -= 1;
                progressBar.increment();

                // console.log(result);        
                if (queued === 0) {
                    console.log('done with queue');
                    progressBar.stop();
                    saveResults();
                }
            });
        }
    });

}

function saveLocationResults() {
    results.forEach((result) => {
        if(!result) return; // could be null when error happens
        LocationSchema.findById(result.object, (err, location) => {
            if(err) {
                console.log(err);
                return;
            }
            if(location.geodata) {
                for(let i = 0; i < location.geodata.length; i++) {
                    let geodata = location.geodata[i];
                    if(geodata._id.toString() === result.geodata) {
                        geodata.lat = result.lat;
                        geodata.lng = result.lng;
                    }
                }
                // console.log('----------');
            }
            location.save((err, saved) => {
                if(err) {
                    console.log(err);
                    return;
                }

                console.log(saved._id + ' saved');
            });
        });
    })
}

function saveResults() {
    for (let i = 0; i < results.length; i++) {
        let event = results[i];
        EventSchema.findById(event.object, function (err, found) {
            if (err) {
                console.log(err);
                return;
            }

            found.geodata.lat = event.lat;
            found.geodata.lng = event.lng;
            found.save(function (saveErr, saveE) {
                if (saveErr) {
                    console.log(saveErr);
                    return;
                }
                // console.log(saveE._id + " saved");
            })
        })
    }
    // EventSchema.find({ _id: event.})
}
