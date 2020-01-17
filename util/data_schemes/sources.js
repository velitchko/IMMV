let mongoose = require('mongoose');

// TODO finalize sources schema
let SourceSchema = new mongoose.Schema({
  name: String,
  status: {
    type: String,
    default: 'OFFLINE'
  }, // ONLINE / OFFLINE
  author: String, // person editing / creating this
  identifiers: [{
    url: String,
    title: String,
    copyright: String,
    identifierType: String,
    sourceType: String
  }],

  provenance: {
    from: String,
    provenanceType: String
  },

  dates: [{
    startDate: String,
    endDate: String,
    dateName: String,
    dateUncertain: Boolean
  }],

  languages: [String],
  keywords: [String],
  rights: String,

  sourceType1: String,
  sourceType2: String,

  abstract: String,
  description: String,
  transcript: String,
  creatorContributorPublisher: [{
    personOrganization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PeopleOrganizations'
    },
    position: String,
    role: String
  }],

  sources: [{
    source : {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sources'
    },
    relationship: String
  }],
  //relations: Relation[],
});

SourceSchema.index({'$**': 'text'});

let Source = mongoose.model('Sources', SourceSchema);
module.exports = Source;
