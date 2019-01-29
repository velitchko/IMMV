let mongoose = require('mongoose');
let EventSchema = require('./event');
let axios = require('axios');
let throttledQueue  = require('throttled-queue');
let cli = require('cli-progress');

const api_token = '87a158b71e76a7';
const progressBar = new cli.Bar({}, cli.Presets.shades_classic);
let results = [];

let throttle = throttledQueue(1, 1000);
mongoose.connect('mongodb://localhost:27017/immv_beta', function(err) {
    console.log('DB Connected');
    if(err) {
        console.log(err);
        return;
    }
    
    findEvents();
});


async function geocode(location, event) {
    let query = encodeURIComponent(`${location.streetName} ${location.streetNumber}, ${location.districtNumber} Vienna`);
    let uri = `https://eu1.locationiq.com/v1/search.php?key=${api_token}&q=${query}&format=json&limit=1`;
    try {
        let result = await axios.get(uri);
        return {
                event: event,
                lat: result.data[0].lat,
                lng: result.data[0].lon
            };
    } catch (error) {
        console.log(error);
        return null;
    }
    // console.log(result);
    // return result.data;
}

function findEvents() {
    //  name: { $regex: 'festwochen', $options: 'i' }, geodata: {$exists: true}
    EventSchema.find({}, function(err, events) {
        let queued = events.length;
        progressBar.start(queued, 0);
        if(err) {
            console.log(err);
            return;
        }
    
        // console.log(`${events.length} events found`);
        for(let i = 0; i < events.length; i++) {
            let event = events[i];

            throttle(async function() {
                // console.log(event.geodata);
                // console.log(event.geodata);
                if(event.geodata && event.geodata.streetName) {
                    let result = await geocode(event.geodata, event._id);  
                    if(result) {
                        results.push(result);
                    }
                }
                // console.log('result pushed');
                queued -= 1;
                progressBar.increment();

                // console.log(result);        
                if(queued === 0) {
                    console.log('done with queue');
                    progressBar.stop();
                    saveResults();
                }        
            });
        }
       
    });

}

function saveResults() {
    for(let i = 0; i < results.length; i++) {
        let event = results[i];
        EventSchema.findById(event.event, function(err, found) {
            if(err) {
                console.log(err);
                return;
            }

            found.geodata.lat = event.lat;
            found.geodata.lng = event.lng;
            found.save(function(saveErr, saveE) {
                if(saveErr) {
                    console.log(saveErr);
                    return;
                }
                console.log(saveE._id + " saved");
            })
        })
    }
    // EventSchema.find({ _id: event.})
}
