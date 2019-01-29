let mongoose = require('mongoose');
let EventSchema = require('./event');
let request = require('request');

mongoose.connect('mongodb://localhost/immv2', (err) => {
    if(err) {
        console.log(err);
    }
    console.log('mongoDB connected');
    main();
});
 
let idArr = [

];

function main() {
    promiseArr = [];
    idArr.forEach((oID, idx) => {
        if(idx > 20) return;
        console.log(idx);
        promiseArr.push(new Promise((resolve, reject) => {
            EventSchema.findOne({ _id: oID }, (err, event) => {
            if(err) {
                console.log(err);
                return;
            }
            let addr = event.geodata.streetName;
            if(event.geodata.streetNumber !== '' && event.geodata.streetNumber !== "0") addr += ', ' + event.geodata.streetNumber;
            if(event.geodata.districtNumber !== '' && event.geodata.districtNumber !== "0") addr += ', ' + event.geodata.districtNumber;
            addr += ', Vienna';
            let uri =  'https://nominatim.openstreetmap.org/search/' + encodeURIComponent(addr) + '&?format=json';
        
                    request({
                        method: 'GET',
                        url: uri,
                        headers: {
                            'authority': 'nominatim.openstreetmap.org',
                            'cookie': 'qos_token=649077',
                            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36'
                        }
                    }, (err, response, body)=> {
                        if(err) {
                            console.log(err);
                            // reject(err);
                        }
                     
                        if(body) {
                            let coords = JSON.parse(body);
                                if(coords[0]) {
                                console.log(coords[0].lat, coords[0].lon);
                                console.log('--------');
                                resolve({
                                    eventId: event._id,
                                    lat: coords[0] ? coords[0].lat : '',
                                    lon: coords[0] ? coords[0].lon : ''
                                })
                            } 
                        }
                    });
                })
                // console.log(event.geodata);
            }))
        });

    Promise.all(promiseArr).then((success) => {
        console.log('promises resolved');
        success.forEach((s) => {
            EventSchema.findOne({_id: s.eventId}, (err, event) => {
                event.geodata.lat = s.lat;
                event.geodata.lng = s.lon;
                event.save((err, newE) => {
                    console.log(newE._id + ' saved');
                })
            });
        })
    });
}
//.catch((err) => {
//     console.log(err);
// });