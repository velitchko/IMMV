let mongoose = require('mongoose');
// NOTE: Import locally for some reason it doesnt work when importing from the data_schemes
let EventSchema = require('../data_schemes/event');
let db = require('../data_schemes/db.config');


let assignments = new Map();

assignments.set('Rathausplatz', { lat: 48.210599661281066, lng: 16.35896309910696 });
assignments.set('Heldenplatz', { lat: 48.20596506143824, lng: 16.363897462980376 });
assignments.set('Trabrennplatz', { lat: 48.210599743761165, lng: 16.4146410171778 });
assignments.set('Friedrich-Schmidt-Platz', { lat: 48.21074274071707, lng: 16.357331698393438 });
assignments.set('Lothringerstraße', { lat: 48.20119427803179, lng: 16.378184535187753 });
assignments.set('Musikvereinsplatz', { lat: 48.20052213203104,  lng: 16.372702238928593 });
assignments.set('Opernring', { lat: 48.20308083434796, lng: 16.369011487155753 });
assignments.set('Meiereistraße', { lat: 48.20696932366979, lng: 16.421016206051807 });
assignments.set('Stephansplatz', { lat: 48.20848681638877, lng: 16.37312040232786 });
assignments.set('Roland-Rainer-Platz', { lat: 48.20235232251327, lng: 16.332990602407264 });
assignments.set('Seebühne', { lat: 48.19889757650677 , lng: 16.37139356283538 });

mongoose.set('debug', true);
mongoose.set('useNewUrlParser', true);
mongoose.connect(`mongodb://localhost:27017/${db.collectionName}`, function (err) {
    console.log('DB Connected');
    console.log(`mongodb://localhost:27017/${db.collectionName}`);
    if (err) {
        console.log(err);
        return;
    }
    assignLocation();
    // assignLatLng();
});

function assignLocation() {
    EventSchema.find({ $or: [ {name: /Popfest/}, { name: /Seebühne/}]}, (err, events) => {
        events.forEach((e) => {
            e.geodata.streetName = 'Seebühne';
            e.save();
        });
    })
}

function assignLatLng() {
    assignments.forEach((value, key) => {
        EventSchema.find({ 'geodata.streetName': key}, (err, events) => {
            console.log(`#${events.length} matching Events with Location: ${key}`)
            events.forEach((e) => {
                e.geodata.lat = value.lat;
                e.geodata.lng = value.lng;
                e.save();
            });
        });
    });

}