let mongoose = require('mongoose');
// NOTE: Import locally for some reason it doesnt work when importing from the data_schemes
let EventSchema = require('../data_schemes/event');
let PersonOrganizationSchema = require('../data_schemes/personorganization');
let HistoricEventSchema = require('../data_schemes/historicevents');
let csvWriter = require('csv-writer').createObjectCsvWriter;
let db = require('../data_schemes/db.config');

mongoose.set('debug', true);
mongoose.set('useNewUrlParser', true);
mongoose.connect(`mongodb://localhost:27017/${db.collectionName}`, function (err) {
    console.log('DB Connected');
    console.log(`mongodb://localhost:27017/${db.collectionName}`);
    if (err) {
        console.log(err);
        return;
    }
    let csv = csvWriter({
        path: './historic_events.csv',
        header: [
            {id: 'name', title: 'NAME'},
            // {id: 'type', title: 'TYPE'}
        ]
    });
    let promise = generateList();
    promise.then((success) => {
        let records = [];
        success.forEach((s) => {
            records.push({
                name: s.name,
                // type: s.objectType
            });
        })
        csv.writeRecords(records).then(() => {
            console.log('Done.');
        });
    })
});


function generateList() {
    return HistoricEventSchema.find({}, (err, events) => {
        events.forEach((e) => {
            // console.log(e.name);
            // records.push({
            //     name: e.name
            // });
            // console.log(
            //     `${e.name};`
            // );
            // if(e.themes.map((t) => { return t.theme; }).includes('5e2ed8c0535e330852ea6ba7')) {
            //     console.log(e.name + '; ' + e._id);
                
            // }
        //     if(e.geodata) {
        //         if(!e.geodata.lat || !e.geodata.lng) {
        //             console.log(e.name + ';' + e._id);
        //             return;
        //         }

        //         if(e.geodata.lat === '' || e.geodata.lng === '') {
        //             console.log(e.name + ';' + e._id);
        //             return;
        //         }

        //         if(e.geodata.lat === 0 && e.geodata.lng === 0) {
        //             console.log(e.name + ';' + e._id);
        //             return;
        //         }

        //         if(e.geodata.lat === '0' || e.geodata.lng === '0') {
        //             console.log(e.name + ';' + e._id);
        //             return;
        //         }
        //     } else {
        //         console.log(e.name + ';' + e._id);
        //         return;
        //     }
        });
    }).exec();
}