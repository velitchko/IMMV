let mongoose = require('mongoose');

let ThemeSchema = new mongoose.Schema({
  name: String,
  status: {
    type: String,
    default: 'OFFLINE'
  }, // ONLINE / OFFLINE
  author: String, // person editing / creating this
  // aka
  names: [{
    name: String,
    nameType: String
  }],

  abstract: String,
  description: String,

  dates: [{
    startDate: String,
    endDate: String,
    dateName: String,
    dateUncertain: Boolean
  }],

  themeTypes: [String],

  identifiers: [{
    url: String,
    title: String,
    copyright: String,
    identifierType: String
  }],

  themes: [{
    theme: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Themes'
    },
    relationship: String
  }]
});

ThemeSchema.index({'$**': 'text'});

let Theme = mongoose.model('Themes', ThemeSchema);
module.exports = Theme;
