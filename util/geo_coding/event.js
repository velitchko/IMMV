let mongoose = require('mongoose');

let EventSchema = new mongoose.Schema({
  // general
  name: String,
  status: {
    type: String,
    default: 'OFFLINE'
  }, // ONLINE / OFFLINE
  author: String, // person editing / creating this
  eventType: String,
  startDate: Date,
  endDate: Date,
  // meta data
  internal: String,
  external: String,
  // OLD
  // abstract: String,
  // interpretation: String,
  // formal: String,
  // eventCharacterization: String,
  // spatialUseAndType: String,
  // audienceAndAction: String,
  // ideology: String,
  // education: String,
  // ephemeralView: String,

  // medialCoverage: [String],
  // eras: [String],
  // season: String,
  geodata: { // main location?
    streetName: String,
    streetNumber: String,
    districtNumber: String,
    lat: String,
    lng: String
  }, // array of routes; routes are arrays of points (geodata)
  routes: [[{ // double array routes -> route[] -> markers[]
    streetName: String,
    streetNumber: String,
    districtNumber: String,
    lat: String,
    lng: String
  }]],
  // internal
  isMainEvent: {
    type: Boolean,
    default: true
  },
  // relationships
  contributor: [{
    personOrganization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PeopleOrganizations'
    },
    role: String
  }],
  creator: [{
    personOrganization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PeopleOrganizations'
    },
    role: String
  }],
  peopleOrganizations: [{
    personOrganization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PeopleOrganizations'
    },
    role: String,
    relationship: String,
  }],
  locations: [{
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Locations'
    },
    relationship: String,
  }],
  events: [{
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Events'
    },
    relationship: String
  }],
  sources: [{
    source: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sources'
    },
    relationship: String,
  }],
  themes: [{
    theme: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Themes'
    },
    relationship: String,
  }],
  historicEvents: [{
    historicEvent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HistoricEvents'
    },
    relationship: String
  }]
});
// make all text fields (string) indexable
// allows for fulltext (partial string matching) querying
EventSchema.index({'$**': 'text'});

let Event = mongoose.model('Events', EventSchema);
module.exports = Event;
