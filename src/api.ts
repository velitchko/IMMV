import { ngExpressEngine, NgSetupOptions } from '@nguniversal/express-engine';

import * as express from 'express';
import * as mongoose from 'mongoose';
import * as path from 'path';
let EventSchema = require('./database/schemas/event');
let HistoricEventSchema = require('./database/schemas/historicevent');
let LocationSchema = require('./database/schemas/location');
let ThemeSchema = require('./database/schemas/theme');
let PersonOrganizationSchema = require('./database/schemas/personorganization');
let SourceSchema = require('./database/schemas/source');

export function createApi(distPath: string, ngSetupOptions: NgSetupOptions) {
  const api = express();
  const UPLOAD_DIR_PATH = 'uploads';
  mongoose.connect('mongodb://localhost/immv2', (err) => {
    if(err) console.log(err);
    console.log('Connected to MongoDB/immv2');
  });
  mongoose.set('useNewUrlParser', true);
  api.set('view engine', 'html');
  api.set('views', distPath);

  // Angular Express Engine
  api.engine('html', ngExpressEngine(ngSetupOptions));

  
  api.get('/api/v1/events', (req: express.Request, res: express.Response) => {
    console.log('getting events');
    EventSchema.find({}, (err, events) => {
      if(err) {
        res.status(404).json({ "message" : 'No documents matching ' + req.body.query + ' were found.'})
      }
      if(events) {
        res.status(200).json({ "message" : 'Documents found ' + events.length, data: events});
      }
    });
  });
  api.get('/api/v1/historicevents', (req: express.Request, res: express.Response) => {
    HistoricEventSchema.find({}, (err, historicEvents) => {
      if(err) {
        res.status(404).json({ "message" : 'No documents matching ' + req.body.query + ' were found.'})
      }
      if(historicEvents) {
        res.status(200).json({ "message" : 'Documents found ' + historicEvents.length, data: historicEvents});
      }
    });
  });
  api.get('/api/v1/peopleorganizations', (req: express.Request, res: express.Response) => {
    PersonOrganizationSchema.find({}, (err, peopleOrganizations) => {
      if(err) {
        res.status(404).json({ "message" : 'No documents matching ' + req.body.query + ' were found.'})
      }
      if(peopleOrganizations) {
        res.status(200).json({ "message" : 'Documents found ' + peopleOrganizations.length, data: peopleOrganizations});
      }
    });
  });
  api.get('/api/v1/locations', (req: express.Request, res: express.Response) => {
    LocationSchema.find({}, (err, locations) => {
      if(err) {
        res.status(404).json({ "message" : 'No documents matching ' + req.body.query + ' were found.'})
      }
      if(locations) {
        res.status(200).json({ "message" : 'Documents found ' + locations.length, data: locations});
      }
    });
  });
  api.get('/api/v1/sources', (req: express.Request, res: express.Response) => {
    SourceSchema.find({}, (err, sources) => {
      if(err) {
        res.status(404).json({ "message" : 'No documents matching ' + req.body.query + ' were found.'})
      }
      if(sources) {
        res.status(200).json({ "message" : 'Documents found ' + sources.length, data: sources});
      }
    });
  });
  api.get('/api/v1/themes', (req: express.Request, res: express.Response) => {
    ThemeSchema.find({}, (err, themes) => {
      if(err) {
        res.status(404).json({ "message" : 'No documents matching ' + req.body.query + ' were found.'})
      }
      if(themes) {
        res.status(200).json({ "message" : 'Documents found ' + themes.length, data: themes});
      }
    });
  });
  
  api.get('/api/v1/events/:id', (req: express.Request, res: express.Response) => {
    EventSchema.findOne({ _id : req.params.id }, (err, event) => {
      if(event) {
        res.status(200).json({ "message" : 'Document ' + event._id + ' found.', data : event });
      }
      if(err) {
        res.status(404).json({ "message" : 'No documents matching ' + req.params.id + ' found'});
      }
    });
  });
  api.get('/api/v1/historicevents/:id', (req: express.Request, res: express.Response) => {
    HistoricEventSchema.findOne({ _id : req.params.id }, (err, historicEvent) => {
      if(historicEvent) {
        res.status(200).json({ "message" : 'Document ' + historicEvent._id + ' found.', data : historicEvent });
      }
      if(err) {
        res.status(404).json({ "message" : 'No documents matching ' + req.params.id + ' found'});
      }
    });
  });
  api.get('/api/v1/peopleorganizations/:id', (req: express.Request, res: express.Response) => {
    PersonOrganizationSchema.findOne({ _id : req.params.id }, (err, personOrganization) => {
      if(personOrganization) {
        res.status(200).json({ "message" : 'Document ' + personOrganization._id + ' found.', data : personOrganization });
      }
      if(err) {
        res.status(404).json({ "message" : 'No documents matching ' + req.params.id + ' found'});
      }
    });
  });
  api.get('/api/v1/locations/:id', (req: express.Request, res: express.Response) => {
    LocationSchema.findOne({ _id : req.params.id }, (err, location) => {
      if(location) {
        res.status(200).json({ "message" : 'Document ' + location._id + ' found.', data : location });
      }
      if(err) {
        res.status(404).json({ "message" : 'No documents matching ' + req.params.id + ' found'});
      }
    });
  });
  api.get('/api/v1/sources/:id', (req: express.Request, res: express.Response) => {
    SourceSchema.findOne({ _id : req.params.id }, (err, source) => {
      if(source) {
        res.status(200).json({ "message" : 'Document ' + source._id + ' found.', data : source });
      }
      if(err) {
        res.status(404).json({ "message" : 'No documents matching ' + req.params.id + ' found'});
      }
    });
  });
  api.get('/api/v1/themes/:id', (req: express.Request, res: express.Response) => {
    ThemeSchema.findOne({ _id : req.params.id }, (err, theme) => {
      if(theme) {
        res.status(200).json({ "message" : 'Document ' + theme._id + ' found.', data : theme });
      }
      if(err) {
        res.status(404).json({ "message" : 'No documents matching ' + req.params.id + ' found'});
      }
    });
  });

  /**
  GEOCODE
  **/
  api.get('/api/v1/geocode', (req: express.Request, res: express.Response) => {
    // let promiseArr = new Array<Promise<any>>();
    // EventSchema.find({}, (err, events) => {
    //   events.forEach((e) => {
    //     if((!e.geodata.lat && !e.geodata.lng)) {
    //       if(!e.geodata.streetName) return;
    //       const addr = encodeURIComponent(`${e.geodata.streetName ? e.geodata.streetName : ''}${e.geodata.streetNumber? ' ' + e.geodata.streetNumber : ''}${e.geodata.postalCode ? ', ' + e.geodata.postalCode : ''}, Vienna`);
    //       console.log(addr);
    //       let options = {
    //         url: `https://maps.googleapis.com/maps/api/geocode/json?address=${addr}&key=${environment.GMAPS_API_KEY}`, // + layout,
    //         method: 'GET',
    //         json: true,
    //         rejectUnauthorized: false,
    //         //strictSSL: false,
    //         headers:  {
    //           'Content-Type' : 'application/json'
    //         }
    //       };
    //       promiseArr.push(new Promise<any>((resolve, reject) => {
    //         request(options).then((success) => {
    //           if(success.status === 'OK') {
    //             e.geodata.lat = success.results[0].geometry.location.lat;
    //             e.geodata.lng = success.results[0].geometry.location.lng;
    //             e.save();
    //             resolve(e);
    //           } else {
    //             console.log(success.status);
    //             reject(success.status);
    //           }
    //         });
    //       }));
    //     }
    //   });
    //   Promise.all(promiseArr).then((results) => {
    //     res.status(200).json({ 'message': 'OK', });
    //   });
    // });
  });
  /**
  FIND
  **/
  api.post('/api/v1/search', (req: express.Request, res: express.Response) => {
    let promiseArr = new Array<Promise<any>>();
    // EVENTS
    promiseArr.push(new Promise<any>((resolve, reject) => {
      EventSchema.find( {$text: { $search: req.body.query } }, (err, events) => {
        if(err) {
          reject();//res.status(404).json({ "message" : 'No documents matching ' + req.body.query + ' were found.'})
        }
        if(events) {
          resolve({ events: events, type: 'events' });
          //searchResults.push(events);
        }
      }).exec()
    }));
    // HISTORIC EVENTS
    promiseArr.push(new Promise<any>((resolve, reject) => {
      HistoricEventSchema.find( {$text: { $search: req.body.query } }, (err, events) => {
        if(err) {
          reject();
          // res.status(404).json({ "message" : 'No documents matching ' + req.body.query + ' were found.'})
        }
        if(events) {
          resolve({historicEvents: events, type: 'historicevents' });
          // searchResults.push(events);
        }
      }).exec()
    }));

    // LOCATIONS
    promiseArr.push(new Promise<any>((resolve, reject) => {
      LocationSchema.find( {$text: { $search: req.body.query } }, (err, events) => {
        if(err) {
          reject();
          // res.status(404).json({ "message" : 'No documents matching ' + req.body.query + ' were found.'})
        }
        if(events) {
          resolve({ locations: events, type: 'locations' });
          // searchResults.push(events);
        }
      }).exec()
    }));

    // THEMES
    promiseArr.push(new Promise<any>((resolve, reject) => {
      ThemeSchema.find( {$text: { $search: req.body.query } }, (err, events) => {
        if(err) {
          reject();
          // res.status(404).json({ "message" : 'No documents matching ' + req.body.query + ' were found.'})
        }
        if(events) {
          resolve({ themes: events, type: 'themes' });
          // searchResults.push(events);
        }
      }).exec()
    }));

    // PEOPLE/ORGANIZATIONS
    promiseArr.push(new Promise<any>((resolve, reject) => {
      PersonOrganizationSchema.find( {$text: { $search: req.body.query } }, (err, events) => {
        if(err) {
          reject();
          // res.status(404).json({ "message" : 'No documents matching ' + req.body.query + ' were found.'})
        }
        if(events) {
          resolve({ peopleOrganizations: events, type: 'peopleorganizations' });
          // searchResults.push(events);
        }
      }).exec()
    }));

    // SOURCES
    promiseArr.push(new Promise<any>((resolve, reject) => {
      SourceSchema.find( {$text: { $search: req.body.query } }, (err, events) => {
        if(err) {
          reject();
          // res.status(404).json({ "message" : 'No documents matching ' + req.body.query + ' were found.'})
        }
        if(events) {
          resolve({ sources: events, type: 'sources' });
          // searchResults.push(events);
        }
      }).exec()
    }));

    Promise.all(promiseArr).then((success: any) => {
      res.status(200).json({ "message": "OK", results: success });
    });
  });

  // GET uploaded files
  api.get('/api/v1/uploads/:id', (req: express.Request, res: express.Response) => {
    if(req.params.id) {
      res.status(200).sendFile(path.resolve(`${UPLOAD_DIR_PATH}/${req.params.id}`));
    } else {
      res.status(404).json({ "message" : `${req.params.id} does not exist.`});
    }
  });


  // Server static files from distPath
  api.get('*.*', express.static(distPath));

  // All regular routes use the Universal engine
  api.get('*', (req, res) => res.render('index', { req }));

  return api;
}
