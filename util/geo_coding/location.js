let mongoose = require('mongoose');

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

let Location = mongoose.model('Locations', LocationSchema);
module.exports = Location;
