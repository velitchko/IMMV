import { NgSetupOptions, ngExpressEngine } from '@nguniversal/express-engine';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as mongoose from 'mongoose';
import * as path from 'path';
import * as fs from 'fs';

// DB Schemas
let EventSchema = require('../database/schemas/event');
let HistoricEventSchema = require('../database/schemas/historicevent');
let LocationSchema = require('../database/schemas/location');
let ThemeSchema = require('../database/schemas/theme');
let PersonOrganizationSchema = require('../database/schemas/personorganization');
let SourceSchema = require('../database/schemas/source');
let SnapshotSchema = require('../database/schemas/snapshots');

const PDFImage = require('pdf-image').PDFImage;
const DATABASE_COLLECTION = 'immv2020';
const UPLOAD_DIR_PATH = 'uploads';

export interface ServerAPIOptions {
  distPath: string;
  ngSetup?: NgSetupOptions;
}


export function createApi(options: ServerAPIOptions) {
  const router = express();

  router.use(createNgRenderMiddleware(options.distPath, options.ngSetup));

  return router;
}


export function createNgRenderMiddleware(distPath: string, ngSetup: NgSetupOptions) {
  // Establish DB Connection
  // mongoose.set('debug', true);
  mongoose.set('useNewUrlParser', true);
  mongoose.set('useUnifiedTopology', true);
  mongoose.set('useCreateIndex', true);
  mongoose.connect(`mongodb://localhost/${DATABASE_COLLECTION}`, (err: Error) => {
    if (err) {
      console.log(err);
      return;
    }
    console.log(`Connected to MongoDB/${DATABASE_COLLECTION}`);
  });

  const api = express();

  // Setup body parser
  api.use(bodyParser.json());
  api.use(bodyParser.urlencoded({ extended: true }));
  
  api.set('view engine', 'html');
  api.set('views', distPath);
  
  // Angular Express Engine
  api.engine('html', ngExpressEngine(ngSetup));

  // API endpoints (backend DB calls)
  api.get('/api/v1/events', (req: express.Request, res: express.Response) => {
    EventSchema.find({}, (err: Error, events: Array<any>) => {
      if (err) {
        console.log(err);
        res.status(404).json({ "message": 'No events were found.' })
      }
      if (events) {
        res.status(200).json({ "message": 'Documents found ' + events.length, data: events });
      } else {
        res.status(404).json({ "message": 'No events were found.' })
      }
    });
  });
  
  api.get('/api/v1/historicevents', (req: express.Request, res: express.Response) => {
    HistoricEventSchema.find({}, (err: Error, historicEvents: Array<any>) => {
      if (err) {
        console.log(err);
        res.status(404).json({ "message": 'No historic events were found.' })
      }
      if (historicEvents) {
        res.status(200).json({ "message": 'Documents found ' + historicEvents.length, data: historicEvents });
      } else {
        res.status(404).json({ "message": 'No historic events were found.' })
      }
    });
  });
  
  api.get('/api/v1/peopleorganizations', (req: express.Request, res: express.Response) => {
    PersonOrganizationSchema.find({}, (err: Error, peopleOrganizations: Array<any>) => {
      if (err) {
        console.log(err);
        res.status(404).json({ "message": 'No people or organizations were found.' })
      }
      if (peopleOrganizations) {
        res.status(200).json({ "message": 'Documents found ' + peopleOrganizations.length, data: peopleOrganizations });
      } else {
        res.status(404).json({ "message": 'No people or organizations were found.' })
      }
    });
  });
  
  api.get('/api/v1/locations', (req: express.Request, res: express.Response) => {
    LocationSchema.find({}, (err: Error, locations: Array<any>) => {
      if (err) {
        console.log(err);
        res.status(404).json({ "message": 'No locations were found.' })
      }
      if (locations) {
        res.status(200).json({ "message": 'Documents found ' + locations.length, data: locations });
      } else {
        res.status(404).json({ "message": 'No locations were found.' })
      }
    });
  });
  
  api.get('/api/v1/sources', (req: express.Request, res: express.Response) => {
    SourceSchema.find({}, (err: Error, sources: Array<any>) => {
      if (err) {
        console.log(err);
        res.status(404).json({ "message": 'No sources were found.' })
      }
      if (sources) {
        res.status(200).json({ "message": 'Documents found ' + sources.length, data: sources });
      } else {
        res.status(404).json({ "message": 'No sources were found.' })
      }
    });
  });
  
  api.get('/api/v1/themes', (req: express.Request, res: express.Response) => {
    ThemeSchema.find({}, (err: Error, themes: Array<any>) => {
      if (err) {
        console.log(err);
        res.status(404).json({ "message": 'No themes were found.' })
      }
      if (themes) {
        res.status(200).json({ "message": 'Documents found ' + themes.length, data: themes });
      } else {
        res.status(404).json({ "message": 'No themes were found.' })
      }
    });
  });
  
  api.get('/api/v1/events/:id', (req: express.Request, res: express.Response) => {
    EventSchema.findOne({ _id: req.params.id }, (err: Error, event: any) => {
      if (err) {
        console.log(err);
        res.status(404).json({ "message": 'No documents matching ' + req.params.id + ' found' });
      }
      if (event) {
        res.status(200).json({ "message": 'Document ' + event._id + ' found.', data: event });
      } else {
        res.status(404).json({ "message": 'Document ' + req.params.id + ' not found' });
      }
    });
  });
  
  api.get('/api/v1/historicevents/:id', (req: express.Request, res: express.Response) => {
    HistoricEventSchema.findOne({ _id: req.params.id }, (err: Error, historicEvent: any) => {
      if (err) {
        console.log(err);
        res.status(404).json({ "message": 'No documents matching ' + req.params.id + ' found' });
      }
      if (historicEvent) {
        res.status(200).json({ "message": 'Document ' + historicEvent._id + ' found.', data: historicEvent });
      } else {
        res.status(404).json({ "message": 'Document ' + req.params.id + ' not found' });
      }
    });
  });
  
  api.get('/api/v1/peopleorganizations/:id', (req: express.Request, res: express.Response) => {
    PersonOrganizationSchema.findOne({ _id: req.params.id }, (err: Error, personOrganization: any) => {
      if (err) {
        console.log(err);
        res.status(404).json({ "message": 'No documents matching ' + req.params.id + ' found' });
      }
      if (personOrganization) {
        res.status(200).json({ "message": 'Document ' + personOrganization._id + ' found.', data: personOrganization });
      } else {
        res.status(404).json({ "message": 'Document ' + req.params.id + ' not found' });
      }
    });
  });
  
  api.get('/api/v1/locations/:id', (req: express.Request, res: express.Response) => {
    LocationSchema.findOne({ _id: req.params.id }, (err: Error, location: any) => {
      if (err) {
        console.log(err);
        res.status(404).json({ "message": 'No documents matching ' + req.params.id + ' found' });
      }
      if (location) {
        res.status(200).json({ "message": 'Document ' + location._id + ' found.', data: location });
      } else {
        res.status(404).json({ "message": 'Document ' + req.params.id + ' not found' });
      }
    });
  });
  
  api.get('/api/v1/sources/:id', (req: express.Request, res: express.Response) => {
    SourceSchema.findOne({ _id: req.params.id }, (err: Error, source: any) => {
      if (err) {
        console.log(err);
        res.status(404).json({ "message": 'No documents matching ' + req.params.id + ' found' });
      }
      if (source) {
        res.status(200).json({ "message": 'Document ' + source._id + ' found.', data: source });
      } else {
        res.status(404).json({ "message": 'Document ' + req.params.id + ' not found' });
      }
    });
  });
  
  api.get('/api/v1/themes/:id', (req: express.Request, res: express.Response) => {
    ThemeSchema.findOne({ _id: req.params.id }, (err: Error, theme: any) => {
      if (err) {
        console.log(err);
        res.status(404).json({ "message": 'No documents matching ' + req.params.id + ' found' });
      }
      if (theme) {
        res.status(200).json({ "message": 'Document ' + theme._id + ' found.', data: theme });
      } else {
        res.status(404).json({ "message": 'Document ' + req.params.id + ' not found' });
      }
    });
  });
  
  api.get('/api/v1/getMainThemes', (req: express.Request, res: express.Response) => {
    let query = { themeTypes: { $in: ['Main Topics'] } };
    
    ThemeSchema.find(query, (err: Error, themes: Array<any>) => {
      if(err) {
        console.log(err);
        res.status(404).json({ "message": 'No themes found' });
      }
  
      res.status(200).json({ "message": "OK", results: themes });
    });
  });
  
  /**
  FIND
  **/
  // TODO: Just query by name / title of items?
  api.post('/api/v1/search', (req: express.Request, res: express.Response) => {
    let promiseArr = new Array<Promise<any>>();
    // EVENTS
    promiseArr.push(new Promise<any>((resolve, reject) => {
      EventSchema.find({ $text: { $search: req.body.query } }, (err: Error, events: Array<any>) => {
        if (err) {
          reject();//res.status(404).json({ "message" : 'No documents matching ' + req.body.query + ' were found.'})
        }
        if (events) {
          resolve({ events: events, type: 'events' });
          //searchResults.push(events);
        }
      }).exec()
    }));
    // HISTORIC EVENTS
    promiseArr.push(new Promise<any>((resolve, reject) => {
      HistoricEventSchema.find({ $text: { $search: req.body.query } }, (err: Error, historicEvents: Array<any>) => {
        if (err) {
          reject();
          // res.status(404).json({ "message" : 'No documents matching ' + req.body.query + ' were found.'})
        }
        if (historicEvents) {
          resolve({ historicEvents: historicEvents, type: 'historicevents' });
          // searchResults.push(events);
        }
      }).exec()
    }));
  
    // LOCATIONS
    promiseArr.push(new Promise<any>((resolve, reject) => {
      LocationSchema.find({ $text: { $search: req.body.query } }, (err: Error, locations: Array<any>) => {
        if (err) {
          reject();
          // res.status(404).json({ "message" : 'No documents matching ' + req.body.query + ' were found.'})
        }
        if (locations) {
          resolve({ locations: locations, type: 'locations' });
          // searchResults.push(events);
        }
      }).exec()
    }));
  
    // THEMES
    promiseArr.push(new Promise<any>((resolve, reject) => {
      ThemeSchema.find({ $text: { $search: req.body.query } }, (err: Error, themes: Array<any>) => {
        if (err) {
          reject();
          // res.status(404).json({ "message" : 'No documents matching ' + req.body.query + ' were found.'})
        }
        if (themes) {
          resolve({ themes: themes, type: 'themes' });
          // searchResults.push(events);
        }
      }).exec()
    }));
  
    // PEOPLE/ORGANIZATIONS
    promiseArr.push(new Promise<any>((resolve, reject) => {
      PersonOrganizationSchema.find({ $text: { $search: req.body.query } }, (err: Error, peopleOrganizations: Array<any>) => {
        if (err) {
          reject();
          // res.status(404).json({ "message" : 'No documents matching ' + req.body.query + ' were found.'})
        }
        if (peopleOrganizations) {
          resolve({ peopleOrganizations: peopleOrganizations, type: 'peopleorganizations' });
          // searchResults.push(events);
        }
      }).exec()
    }));
  
    // SOURCES
    promiseArr.push(new Promise<any>((resolve, reject) => {
      SourceSchema.find({ $text: { $search: req.body.query } }, (err: Error, sources: Array<any>) => {
        if (err) {
          reject();
          // res.status(404).json({ "message" : 'No documents matching ' + req.body.query + ' were found.'})
        }
        if (sources) {
          resolve({ sources: sources, type: 'sources' });
          // searchResults.push(events);
        }
      }).exec()
    }));
  
    Promise.all(promiseArr).then((success: any) => {
      res.status(200).json({ "message": "OK", results: success });
    });
  });
  
  api.post('/api/v1/query', (req: express.Request, res: express.Response) => {
    let query = { themes: { $elemMatch: { theme: mongoose.Types.ObjectId(req.body.query) } } };
    EventSchema.find(query, (err: Error, events: Array<any>) => {
      if (err) {
        console.log(err);
        res.status(500).json({ "message": "ERROR", "error": err });
      }
      res.status(200).json({ "message": "OK", results: events });
    });
  });
  
  api.post('/api/v1/snapshots', (req: express.Request, res: express.Response) => {
    let snapshot = new SnapshotSchema();
    console.log('saving snapshot');
    console.log(req.body.parameters)
    snapshot.parameters = req.body.parameters;
  
    snapshot.save((err: Error, savedSnapshot: any) => {
      if (err) {
        console.log(err);
        res.status(500).json({ 'message': 'ERROR', results: err });
      }
      res.status(200).json({ 'message': 'OK', results: savedSnapshot });
    });
  });
  
  /**
   * QUERY EVENTS BY RELATIONS (REVERSE LOOKUP)
   */
  api.post('/api/v1/reverseLookupEvents', (req: express.Request, res: express.Response) => {
    let query = { [req.body.relationship]: { $elemMatch: { [req.body.field]: mongoose.Types.ObjectId(req.body.query) } } };
    EventSchema.find(query, (err: Error, events: Array<any>) => {
      if (err) {
        console.log(err);
        res.status(500).json({ "message": "ERROR", "error": err });
      }
      res.status(200).json({ "message": "OK", results: events });
    });
  });
  
  api.post('/api/v1/getEventsByLocations', (req: express.Request, res: express.Response) => {
    // get all locations
    // get locations by theme id? 'key-location' theme
    // let themeId = req.body.theme; 
    // let lQuery = { }
    LocationSchema.find({}, (err: Error, locations: Array<any>) => {
      if (err) {
        console.log(err);
        res.status(500).json({ "message": "ERROR", "error": err });
      }
  
      let promiseArr = new Array<Promise<any>>();
      locations.forEach((l: any) => {
        let query = { locations: { $elemMatch: { location: l._id } } };
        promiseArr.push(new Promise<any>((resolve, reject) => {
          EventSchema.find(query, (err: Error, events: Array<any>) => {
            if (err) {
              console.log(err);
              reject(err)
            }
            resolve({
              location: l,
              events: events
            });
          });
        }));
      });
  
      Promise.all(promiseArr).then((results: any) => {
        // only return locations with events
        let out = new Array<any>();
        results.forEach((r: any) => {
          if(!r) return;
          if(r.events.length > 0) out.push(r);
        });
        res.status(200).json({ "message": "OK", results: out });
      });
    });
  });
  
  api.post('/api/v1/getRelationshipCount', (req: express.Request, res: express.Response) => { 
    let objectType = req.body.objectType.toLowerCase();
    let objectId = req.body.objectId;
    switch(objectType) {
      case 'event': 
        EventSchema.findById({_id: mongoose.Types.ObjectId(objectId)}, (err: Error, result: any) => {
          if(err) { 
            console.log(err);
            res.status(500).json({ "message": "ERROR", "error": err });
          }
          let relCnt = 0;
          relCnt += result.events.length;
          relCnt += result.historicEvents.length;
          relCnt += result.peopleOrganizations.length;
          relCnt += result.sources.length;
          relCnt += result.locations.length;
          relCnt += result.themes.length;
          res.status(200).json({ "message": "OK", results: relCnt})
        });
        break;
      // all three cases together
      case 'organization':
      case 'person':
      case 'personorganization':
          PersonOrganizationSchema.findById({_id: mongoose.Types.ObjectId(objectId)}, (err: Error, result: any) => {
            if(err) { 
              console.log(err);
              res.status(500).json({ "message": "ERROR", "error": err });
            }
            let relCnt = 0;
            relCnt += result.peopleOrganizations.length;
            let query = { peopleOrganizations: { $elemMatch: { personOrganization: objectId } } };
            EventSchema.find(query, (err: Error, results: any) => {
              if(err) { 
                console.log(err);
                return;
              }
              if(results) relCnt += results.length;
              res.status(200).json({ "message": "OK", results: relCnt });
            });
          });
          break;
      case 'theme':
          ThemeSchema.findById({_id: mongoose.Types.ObjectId(objectId)}, (err: Error, result: any) => {
            if(err) { 
              console.log(err);
              res.status(500).json({ "message": "ERROR", "error": err });
            }
            let relCnt = 0;
            relCnt += result.themes.length;
            let query = { themes: { $elemMatch: { theme: objectId } } };
            EventSchema.find(query, (err: Error, results: any) => {
              if(err) { 
                console.log(err);
                return;
              }
              if(results) relCnt += results.length;
              res.status(200).json({ "message": "OK", results: relCnt });
            });
          });
          break;
      case 'location':
          LocationSchema.findById({_id: mongoose.Types.ObjectId(objectId)}, (err: Error, result: any) => {
            if(err) { 
              console.log(err);
              res.status(500).json({ "message": "ERROR", "error": err });
            }
            let relCnt = 0;
            relCnt += result.locations.length;
            let query = { locations: { $elemMatch: { location: objectId } } };
            EventSchema.find(query, (err: Error, results: any) => {
              if(err) { 
                console.log(err);
                return;
              }
              if(results) relCnt += results.length;
              res.status(200).json({ "message": "OK", results: relCnt });
            });
          });
          break;
      case 'historicevent':
          HistoricEventSchema.findById({_id: mongoose.Types.ObjectId(objectId)}, (err: Error, result: any) => {
            if(err) { 
              console.log(err);
              res.status(500).json({ "message": "ERROR", "error": err });
            }
            let relCnt = 0;
            relCnt += result.historicEvents.length;
            let query = { historicEvents: { $elemMatch: { historicEvent: objectId } } };
            EventSchema.find(query, (err: Error, results: any) => {
              if(err) { 
                console.log(err);
                return;
              }
              if(results) relCnt += results.length;
              res.status(200).json({ "message": "OK", results: relCnt });
            });
          });
          break;
      case 'source':
          SourceSchema.findById({_id: mongoose.Types.ObjectId(objectId)}, (err: Error, result: any) => {
            if(err) { 
              console.log(err);
              res.status(500).json({ "message": "ERROR", "error": err });
            }
            let relCnt = 0;
            relCnt += result.sources.length;
            let query = { sources: { $elemMatch: { source: objectId } } };
            EventSchema.find(query, (err: Error, results: any) => {
              if(err) { 
                console.log(err);
                return;
              }
              if(results) relCnt += results.length;
              res.status(200).json({ "message": "OK", results: relCnt });
            });
          });
          break;
      default: 
        res.status(400).json({ "message": "ERROR", "error": "Object type could not be detected." });
        break;
    }
  });
  
  api.post('/api/v1/getLocationsByTheme', (req: express.Request, res: express.Response) => {
    let themeId = req.body.theme;
  
    let query = { themes: { $elemMatch: { theme: themeId } } };
    // get events by theme
    EventSchema.find(query, (err: Error, events: Array<any>) => {
      if (err) {
        console.log(err);
        res.status(500).json({ "message": "ERROR", "error": err });
      }
      // get people by events
      let locations = new Set<string>();
      events.forEach((event: any) => {
        // conductor, musician, composer
        event.locations.forEach((location: any) => {
          if (locations.has(location.location.toString())) return;
          locations.add(location.location.toString());
        })
      });
      // promise array to resolve after all queries have been performed
      let promiseArr = new Array<Promise<any>>();
      locations.forEach((p: any) => {
        promiseArr.push(LocationSchema.findOne({ _id: mongoose.Types.ObjectId(p) }).exec());
      });
  
      // send response after promise array resolves
      Promise.all(promiseArr).then((success: any) => {
        let results = new Array<any>();
  
        success.forEach((s: any) => {
          if (!s) return;
            results.push(s);
        });
        res.status(200).json({ "message": "OK", results: results });
      });
    });
  });
  
  api.post('/api/v1/getPeopleByTheme', (req: express.Request, res: express.Response) => {
    let themeId = req.body.theme;
  
    let query = { themes: { $elemMatch: { theme: themeId } } };
    // get events by theme
    EventSchema.find(query, (err: Error, events: Array<any>) => {
      if (err) {
        console.log(err);
        res.status(500).json({ "message": "ERROR", "error": err });
      }
      // get people by events
      let people = new Set<string>();
      events.forEach((event: any) => {
        // conductor, musician, composer
        event.peopleOrganizations.forEach((person: any) => {
          if (people.has(person.personOrganization.toString())) return;
          people.add(person.personOrganization.toString());
        })
      });
      // promise array to resolve after all queries have been performed
      let promiseArr = new Array<Promise<any>>();
      people.forEach((p: any) => {
        promiseArr.push(PersonOrganizationSchema.findOne({ _id: mongoose.Types.ObjectId(p) }).exec());
      });
  
      // send response after promise array resolves
      // TODO: Parse and provide response in data format that D3 will understand
      Promise.all(promiseArr).then((success: any) => {
        let results = new Array<any>();
  
        success.forEach((s: any) => {
          if (!s) return;
          if (s.objectType === 'Person' && (s.roles.includes('Composer') || s.roles.includes('Musician') || s.roles.includes('Conductor'))) {
            results.push(s);
          }
        });
        res.status(200).json({ "message": "OK", results: results });
      });
    });
  });
  
  // GET uploaded files
  api.get('/api/v1/uploads/:id', (req: express.Request, res: express.Response) => {
    if (req.params.id) {      
      if(fs.existsSync(path.resolve(`${UPLOAD_DIR_PATH}/${req.params.id}`))) {
        res.status(200).sendFile(path.resolve(`${UPLOAD_DIR_PATH}/${req.params.id}`));  
        return;
      }
      if(fs.existsSync(path.resolve(`${UPLOAD_DIR_PATH}/${encodeURI(req.params.id)}`))) {
        res.status(200).sendFile(path.resolve(`${UPLOAD_DIR_PATH}/${encodeURI(req.params.id)}`));  
        return;
      }
      if(fs.existsSync(path.resolve(`${UPLOAD_DIR_PATH}/${decodeURI(req.params.id)}`))) {
        res.status(200).sendFile(path.resolve(`${UPLOAD_DIR_PATH}/${decodeURI(req.params.id)}`));  
        return;
      }
    } else {
      res.status(404).json({ "message": `${req.params.id} does not exist.` });
      return;
    }
  });
  
  // Convert pdf to image and return paths
  api.post('/api/v1/getAsImage', (req: express.Request, res: express.Response) => {
    let filePath = req.body.path;
    if (!filePath) {
      res.status(500).json({ "message": "ERROR", "error": "No file path provided" });
    }
    //${UPLOAD_DIR_PATH}/
    let file = path.resolve(`${filePath}`);
    let pdfImage = new PDFImage(file);
    if (req.body.page !== null && req.body.page !== undefined) {
      let page = parseInt(req.body.page);
      pdfImage.convertPage(page).then((image: any) => {
        let result = image.split('/immv-app/uploads/')[1];
        res.status(200).json({ "message": "OK", "results": result });
      }).catch((err: Error) => {
        console.log('ERROR');
        console.log(err);
        res.status(500).json({ "message": "ERROR", "error": err });
      });
    } else {
      pdfImage.convertFile().then((images: any) => {
        let result = new Array<string>();
        images.forEach((p: string) => {
          let imageFileName = p.split('/immv-app/uploads/')[1];
          result.push(imageFileName);
        });
        res.status(200).json({ "message": "OK", "results": result });
      }).catch((err: Error) => {
        console.log('ERROR');
        console.log(err);
        res.status(500).json({ "message": "ERROR", "error": err });
      });
    }
  });
  
  // GET Snapshots
  api.get('/api/v1/snapshots/:id', (req: express.Request, res: express.Response) => {
    if (req.params.id) {
      SnapshotSchema.findOne({ _id: req.params.id }, (err: Error, snapshot: any) => {
        if (err) {
          console.log(err);
          res.status(500).json({ 'message': 'ERROR', results: err });
        }
  
        res.status(200).json({ "message": "OK", results: snapshot });
      })
    } else {
      res.status(500).json({ "message": "ERROR", results: 'No snapshot matching ' + req.params.id + ' found' });
    } 
  });
  
  // Server static files from distPath
  api.get('*.*', express.static(distPath));

  // All regular routes use the Universal engine
  api.get('*', (req, res) => res.render('index', { req, res }));

  return api;
}
