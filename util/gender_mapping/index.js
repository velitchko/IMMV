let PersonOrganizationSchema = require('./personorganization');
let mongoose = require('mongoose');
let axios = require('axios');
let throttledQueue  = require('throttled-queue');
let cli = require('cli-progress');

let db = require('../data_schemes/db.config');

const api_token = 'ZmVgRrSlNbbaEanjGA';
const gender_api = 'https://gender-api.com/get';
// example usage: http.get(`${gender_api}?split=${name}&key=${api_token}`);
// [IMPORTANT] use urlEncode for the name!
const progressBar = new cli.Bar({}, cli.Presets.shades_classic);

let results = [];

let throttle = throttledQueue(1, 1000);
mongoose.connect(`mongodb://localhost:27017/${db.collectionName}`, function(err) {
    if(err) {
        console.log(err);
        return;
    }
    console.log('DB Connected');
    
    findPeople();
});

async function gendercode(name, person) {
    let encodedName = encodeURIComponent(name);

    let uri = `${gender_api}?split=${encodedName}&key=${api_token}`;
    try {
        let result = await axios.get(uri);
        return {
            person: person._id,
            gender: result.data.gender
        };
    } catch (error) {
        console.log(error);
        return null;
    }
}

function findPeople() {
    // console.log(PersonOrganizationSchema);
    PersonOrganizationSchema.find({ objectType: 'Person' }, function(err, people) {
        let queued = people.length;
        progressBar.start(queued, 0);
        if(err) {
            console.log(err);
            return;
        }
        
        for(let i = 0; i < people.length; i++) {
            let person = people[i];
            throttle(async function() {
                if(!person.gender) {
                let genderForPerson = await gendercode(person.name, person);
                if(genderForPerson) results.push(genderForPerson);
                }
                queued -= 1;
                progressBar.increment();

                if(queued === 0) {
                    console.log('done with queue');
                    progressBar.stop();
                    saveResults();
                }        
            });
        }
    });
};

function saveResults() {
    for(let i = 0; i < results.length; i++){
        let person = results[i];
        
        PersonOrganizationSchema.findById(person.person._id, function(err, found) {
            if(err) {
                console.log(err);
                return;
            }

            found.gender = person.gender;
            found.save(function(saveErr, saveP) {
                if(saveErr) {
                    console.log(saveErr);
                    return;
                }

                console.log(saveP._id + ' saved');
            });
        });
    }
}