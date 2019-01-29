import * as mongoose from 'mongoose';


let PersonOrganizationSchema = new mongoose.Schema({
  name: String,
  status: {
    type: String,
    default: 'OFFLINE'
  }, // ONLINE / OFFLINE
  author: String, // person editing / creating this
  objectType: String,

  identifiers: [{
    url: String,
    title: String,
    copyright: String,
    identifierType: String
  }],
  names: [{
    name: String,
    nameType: String,
    startDate: Date, // start / end dates only for organizations
    endDate: Date
  }],

  dates: [{
    date: String,
    dateName: String
  }],

  organizationTypes: [String],

  abstract: String,
  description: String,
  bio: String,

  roles: [String],
  functions: [{
    startDate: Date,
    endDate: Date,
    dateName: String
  }],

  peopleOrganizations: [{
    personOrganization : {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PeopleOrganizations'
    },
    relationship: String
  }]
});

PersonOrganizationSchema.index({'$**': 'text'});

let PersonOrganization = mongoose.model('PeopleOrganizations', PersonOrganizationSchema);
module.exports = PersonOrganization;
