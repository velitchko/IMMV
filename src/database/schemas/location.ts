import * as mongoose from 'mongoose';
import * as request from 'request';
import { environment } from '../../environments/environment';

let LocationSchema = new mongoose.Schema({
  name: String,
  status: {
    type: String,
    default: 'OFFLINE'
  }, // ONLINE / OFFLINE
  author: String, // person editing / creating this
  names: [{ // alternative names based on time
    name: String,
    nameType: String,
    startDate: Date,
    endDate: Date
  }],
  locationTypes: [String],
  identifiers: [{
    url: String,
    title: String,
    copyright: String,
    identifierType: String
  }],
  //postalCode: String,
  geodata: [{
    streetName: String,
    streetNumber: String,
    districtNumber: Number,
    lat: Number,
    lng: Number,
  }],
  locations: [{
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Locations'
    },
    relationship: String
  }]
});

LocationSchema.index({'$**': 'text'});
// uncomment for geocoding
// LocationSchema.pre('save', function(next) {
//   let _self: any = this;
//   let options = {
//     method: 'GET',
//     url: 'https://maps.googleapis.com/maps/api/geocode/json',
//     qs: {
//       address: `${_self.geodata.streetName} ${_self.geodata.streetNumber} ${_self.geodata.districtNumber}, Wien`,
//       key: environment.GMAPS_API_KEY // Need to get API Key From Google
//     }
//   };
//
//   if(options.qs.address !== "  , Wien") {
//     console.log('requesting ' + options.qs.address);
//     request(options, function(error, response, body) {
//       if(error) {
//         console.log(error);
//       }
//       // set lat/lng and save
//       let coords = JSON.parse(body).results[0].geometry.location;
//       // console.log(body.results[0].geometry.location.lat + ', ' + body.results[0].geometry.location.lng);
//       _self.geodata.lat = coords.lat;
//       _self.geodata.lng = coords.lng;
//       next();
//       // location.save((err, newLoc)=> {
//       //   if(err) {
//       //     console.log('error');
//       //     console.log(err)
//       //   }
//       //   console.log('location saved');
//       // })
//       });
//     } else {
//       // no address just save?
//     next();
//     }
// });

let Location = mongoose.model('Locations', LocationSchema);
module.exports = Location;
