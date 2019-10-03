import { Component, OnInit, ViewChild, Inject, ElementRef, EventEmitter } from '@angular/core';
import { DatabaseService } from '../../services/db.service';
import { PersonOrganization } from '../../models/person.organization';
import { Location } from '../../models/location';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { Event } from '../../models/event';
import * as d3 from 'd3';
import * as moment from 'moment';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { map, startWith, filter } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ActivatedRoute } from "@angular/router";

// Endpoint for current vis
const _VIS: string = 'biographical';

@Component({
  selector: 'app-biographical',
  templateUrl: './biographical.component.html',
  styleUrls: ['./biographical.component.scss']
})

export class BiographicalComponent implements OnInit {
  // HTML 
  @ViewChild('timelineRadial') timelineRadial: ElementRef;
  @ViewChild('timelineChart') timelineChart: ElementRef;
  @ViewChild('brushHolder') brushContainer: ElementRef;
  @ViewChild('mapHolder') mapContainer: ElementRef;
  @ViewChild('tooltip') tooltip: ElementRef;
  @ViewChild('configInput') configInput: ElementRef;
  // display range
  currentlySelectedMinDate: Date;           // currently displayed min date (selection)
  currentlySelectedMaxDate: Date;           // currently displayed max date (selection)
  currentlySelectedPeople: Array<any>;
  currentlySelectedEvents: Array<any>;

  // Dimensions
  WIDTH: number;                            // width of the browsers viewport
  HEIGHT: number;                           // height of the browsers viewport
  MIN_DATE: moment.Moment;                  // min date
  MAX_DATE: moment.Moment;                  // max date

  // D3 things
  timelineSVG: any;                            // timeline svg holder
  timeChartSVG: any;                           // timeline chart
  brushSVG: any;                               // brush svg holder
  chartBrush: d3.BrushBehavior<any>;           // d3 brush for the chart
  legendSVG: any;                              // legend for the categorical values
  radialG: any;                                // radial group wrapper
  chartG: any;                                 // timeline group wrapper
  xScale: d3.ScaleTime<number, number>;        // timeline extent
  yScale: d3.ScaleLinear<number, number>;      // vertical extent
  xChartScale: d3.ScaleTime<number, number>;   // horizontal scale for the line chart
  yChartScale: d3.ScaleLinear<number, number>; // vertical scale for the line chart
  angleScale: d3.ScaleLinear<number, number>;
  rScale: d3.ScaleTime<number, number>;
  colors: d3.ScaleOrdinal<string, {}>;  // d3 color coding
  categoricalColors: d3.ScaleOrdinal<string, {}>;
  /**
   *  '#006345' - dark green - exile
      '#e333af' - pink - other renamings
      '#54c53e' - light green - life line
      '#027cef' - blue - rest
      '#fe444a' - red - street renaming
   */
  dragEndPoint: number;
  dragStartPoint: number;
  theta: number;
  arc: d3.Arc<any, {}>;

  // internal data structures
  orderingMap: Map<string, Map<string, any>>;
  peopleAngles: Map<string, number>;
  dataInRange: Array<any>;

  countByYear: Array<any>;

  margin = {                                 // margin config for the svg's
    top: 50,
    bottom: 50,
    left: 50,
    right: 50
  };

  // ordering

  // Data
  people: Array<PersonOrganization & Location>;         // people/organizations array
  data: Array<any>;                          // data in d3-ish format
  filteredData: Array<any>;                  // filteredData in d3-ish format

  // Config
  isBrowser: boolean;

  // Frontend
  mouseBehavior: boolean;
  showNames: boolean;
  brushBehavior: boolean;
  showingList: boolean;
  showExiled: boolean;

  eventTypes: Array<string>;

  ordering: Array<string>;
  currentOrder: string;

  grouping: Array<string>;
  currentGrouping: string;

  personSelected: boolean;
  selectedPerson: PersonOrganization & Location;

  // Autocomplete
  peopleCtrl: FormControl;
  filteredPeople: Observable<Array<PersonOrganization & Location>>;

  beingFiltered: boolean;
  currentFilter: string;

  preset: string;
  dataType: string;

  /**
   * @param db DatabaseService - the service we use to perform database queries and get requests
   * @param window (JS) Window object - Leaflet needs this and we provide it (check app.module.ts)
   * @param _platformId Object determining if we are on the server or browser side
   */
  constructor(private db: DatabaseService, @Inject('WINDOW') private window: any, @Inject(PLATFORM_ID) private _platformId: Object, private route: ActivatedRoute) {
    this.preset = this.route.snapshot.paramMap.get('preset');
    this.dataType = this.route.snapshot.queryParamMap.get('dataType');
    this.personSelected = false;

    this.showNames = false;
    this.showingList = false;
    this.mouseBehavior = true;
    this.brushBehavior = true;
    this.beingFiltered = false;
    this.showExiled = false;
    this.currentFilter = '';

    this.peopleCtrl = new FormControl();
    this.filteredPeople = this.peopleCtrl.valueChanges
      .pipe(
        startWith(''),
        map((person: string) => {
          return person ? this.filterPeople(person) : this.people.slice()
        }
        )
      );

    this.people = new Array<PersonOrganization & Location>();
    this.data = new Array<any>();

    this.theta = 0;

    this.colors = d3.scaleOrdinal()
      .domain(['street', 'exhibition', 'exile', 'prize', 'none', 'memorial', 'conference', 'anniversary'])
      .range(['red', 'blue', '#4F8874', 'purple', '#47DBA7', '#ff6bb5', '#ffa500', '#0dff00']); // old none blue - #027cef

    this.categoricalColors = d3.scaleOrdinal()
      .range(['#040404', '#494949', '#a7a7a7', '#d8d8d7']);//(d3.schemeSet2);
    // .domain(['Musician', 'Composer', 'Conductor', 'Author', 'Mixed'])
    // .range(['#F286D2', '#36b3d0', '#FFE18D', '#ff0000', '#efefef']);

    this.eventTypes = new Array<string>('street', 'exhibition', 'prize', 'memorial', 'anniversary', 'conference', 'all');

    this.peopleAngles = new Map<string, number>();

    // TODO: Generalize this
    // meta map
    this.orderingMap = new Map<string, Map<string, any>>();
    // create maps for orderings
    this.orderingMap.set('First Post-death Event', new Map<string, moment.Moment>());
    this.orderingMap.set('Birth', new Map<string, moment.Moment>());
    this.orderingMap.set('Death', new Map<string, moment.Moment>());
    this.orderingMap.set('Honoring Time', new Map<string, moment.Moment>());

    this.ordering = Array.from(this.orderingMap.keys());
    this.currentOrder = 'Birth';

    this.grouping = new Array<string>('None', 'Role', 'Exiled', 'Born after 1945', 'Died before 1938', 'Gender');
    this.currentGrouping = 'None';

    this.currentlySelectedEvents = new Array<any>();
    this.currentlySelectedPeople = new Array<any>();

    this.isBrowser = isPlatformBrowser(this._platformId);
  }

  /**
   * OnInit lifecycle hook 
   * Called when the component is initialized
   * NOTE: Only works on client side (window needs to be defined for leaflet to work)
   * - Subscribe to zoom / brush changes
   * - Performs a GET request to get all people / organizations from the database
   * - Initializes rest of component when request resolves
   */
  ngOnInit(): void {
    if (this.isBrowser) {
      // get data based on data type (passed from URL ?dataType=<data-type> queryParam)
      switch(this.dataType) {
        case 'events': 
          break;
        case 'sources':
          break;
        case 'themes':
          break;
        case 'historicevents':
          break;
        case 'locations':
      this.prepareLocationData();
          break;
        case 'people': 
          this.prepareData();
          break;
        default: 
          this.dataType = 'people';
          this.prepareData();
          break;
        
    }
  }
  }

  /**
   * Clears the input in the autocomplete field
   */
  clearAutoComplete(): void {
    this.peopleCtrl.setValue('');
  }

  /**
   * Returns color for the event type / categorical value
   * @param type event type or categorical value
   */
  getColorForType(type: string): {} {
    return this.colors(type);
  }


  /**
   * Filters the data to find a person by name
   * @param personName the persons name
   */
  filterPeople(personName: string): Array<PersonOrganization & Location> {
    let nameVal = personName.trim().toLowerCase();

    return this.people.filter((person: PersonOrganization & Location) => {

      return person.name.trim().toLowerCase().includes(nameVal) || person.names.map((n: any) => { return n.name.trim().toLowerCase(); }).includes(nameVal);
    });
  }

  /**
   * Rotates the radial vis to focus on a specific highlight
   * @param closed - boolean indicating if a person is selected or de-selected
   */
  spinTo(closed: boolean = false): void {
    if (closed) {
      if (!this.mouseBehavior) this.toggleMouseBehavior(); // turn back on if closing
      // rotate back by -Math.PI
      this.timelineSVG
        .transition().duration(250)
        .attr('transform', 'rotate(0)');
      this.unhighlightPerson();
    } else {
      if (this.mouseBehavior) this.toggleMouseBehavior(); // turn off if true
      // rotate to Math.PI
      let currentAngle = this.peopleAngles.get(this.selectedPerson.name) * (180 / Math.PI); // to degrees
      this.timelineSVG
        .transition().duration(250)
        .attr('transform', `rotate(${180 - currentAngle})`);

      this.highlightPerson(this.selectedPerson.name);
    }
  }

  /**
   * Filters the data based on the type of event provided 
   * Default (no type) returns all data points
   * Calls render to update changes
   * @param type optional parameter to check type for
   */
  filterEventsByType(type?: string): void {
    if (!type) type = 'all';

    this.beingFiltered = true;
    this.currentFilter = type;

    this.radialG.selectAll('.event')
      .transition()
      .duration(250)
      .attr('opacity', (d: any) => {
        if (type === 'all') return 1;
        return (d.color !== type && d.color !== 'none') ? 0.15 : 1;
      })
      .attr('stroke', (d: any) => {
        if (type === 'all') return this.colors(d.color);
        return (d.color !== type && d.color !== 'none') ? '#e7e7e7' : this.colors(d.color);
      });

    this.chartG.selectAll('.dots')
      .transition()
      .duration(250)
      .attr('opacity', (d: any) => {
        if (type === 'all') return 1;
        return (d.color !== type && d.color !== 'none') ? 0.15 : 1;
      })
      .attr('fill', (d: any) => {
        if (type === 'all') return this.colors(d.color);
        return (d.color !== type && d.color !== 'none') ? '#e7e7e7' : this.colors(d.color);
      });
  }

  /**
   * Does some string comparison to determine the type of event 
   * @param eventName name of the event
   */
  getEventType(eventName: string): string {
    // TODO: Event types for Locations?
    let name = eventName.trim().toLowerCase();
    let cat = 'none';
    if (name.includes('gedenk') || name.includes('denkmal') || name.includes('nachlass') || name.includes('büste')) cat = 'memorial';
    if (name.includes('benannt') || name.includes('benennung')) cat = 'street';
    if (name.includes('verleihung') || name.includes('verliehen') || name.includes('preis') || name.includes('bürger') || name.includes('ehrenmedaille')) cat = 'prize';
    if (name.includes('symposium') || name.includes('konferenz')) cat = 'conference';
    if (name.includes('todestag') || name.includes('geburtstag')) cat = 'anniversary';
    if (name.includes('ausstellung')) cat = 'exhibition';
    if (eventName.includes('exil')) cat = 'exile';

    return cat;
  }

  /**
   * Extends the dataset by introducing new events related to certain people
   * @param person person/organization object
   * @param events list of events related to the person/organization object
   */
  addEventsToPerson(person: PersonOrganization & Location, events: Array<Event>): void {
    let deathDate = person.dates.find((d: any) => { return d.dateName === 'Death' ? d : null });
    if (!deathDate) return;

    events.forEach((event: Event) => {
      // if (moment(event.startDate).isBefore(moment(deathDate.date))) return; // only interested in events after death
      if (!event.startDate) return; // no startdate

      if (!this.orderingMap.get('First Post-death Event').has(person.objectId)) {
        this.orderingMap.get('First Post-death Event').set(person.objectId, moment(event.startDate));
      } else {
        let existingDate = this.orderingMap.get('First Post-death Event').get(person.objectId);
        if (existingDate > moment(event.startDate)) this.orderingMap.get('First Post-death Event').set(person.objectId, moment(event.startDate));
      }

      let dataPoint: any = {};
      dataPoint.person = person.name;
      dataPoint.dateID = event.objectId;
      dataPoint.personID = person.objectId;
      dataPoint.startDate = moment(event.startDate);
      dataPoint.endDate = event.endDate ? moment(event.endDate) : moment(event.startDate);
      dataPoint.dateName = event.name;
      dataPoint.type = 'post-life';
      dataPoint.color = this.getEventType(event.name ? event.name : '');
      this.data.push(dataPoint);
    });
  }

  /**
   * Retrieve the persons category
   * @param person person/organization object
   * @param groupingScheme defines the current grouping
   */
  getCategory(person: (PersonOrganization & Location), groupingScheme: string): string {
    let cat = '';
    if (person.roles) {
      if (groupingScheme === 'Role' || groupingScheme === 'None') { // default
        let fallsIntoCat = 0;

        if (person.roles.includes('Musician') || person.roles.includes('Performer') || person.roles.includes('Vocalist')) {
          cat = 'Musician';
          fallsIntoCat++;
        }
        if (person.roles.includes('Author')) {
          cat = 'Author';
          fallsIntoCat++;
        }
        if (person.roles.includes('Composer')) {
          cat = 'Composer'
          fallsIntoCat++;
        }
        if (person.roles.includes('Conductor')) {
          cat = 'Conductor';
          fallsIntoCat++;
        }
        return cat;
      } else if (groupingScheme === 'Exiled') {
        let cat = person.functions.map((f: any) => { return f.dateName; }).includes('Exil') ? 'Exiled' : 'Not-Exiled';
        return cat;
      } else if (groupingScheme === 'Born after 1945') {
        let bday: moment.Moment;

        for (let i = 0; i < person.dates.length; i++) {
          let date = person.dates[i];

          if (date.dateName === 'Birth') {
            bday = moment(date.date);
            return bday.isSameOrAfter('1945', 'year') ? 'Born after 1945' : 'Born before 1945';
          }
        }
        if (!bday) {
          return '?';
        }
      } else if (groupingScheme === 'Died before 1938') {
        let dday: moment.Moment;

        for (let i = 0; i < person.dates.length; i++) {
          let date = person.dates[i];

          if (date.dateName === 'Death') {
            dday = moment(date.date);
            return dday.isSameOrBefore('1938', 'year') ? 'Died before 1938' : 'Died after 1938';
          }
        }
        if (!dday) {
          return '?';
        }
      } else if (groupingScheme === 'Gender') {
        return person.gender;
      }
    } 

    if(person.locationTypes) {
      return person.locationTypes[0] ? person.locationTypes[0] : '?';
      // TODO: Categories for locations????
    }
    // return this.categoricalArray[Math.floor(Math.random() * 3)];
  }

  /**
   * Filters the events and people to only show those that are exiled
   * then orders them according to the current ordering strategy
   * calls render to update changes
   */
  showExile(): void {
    this.showExiled = !this.showExiled;

    if (!this.showExiled) {
      this.updateOrder();
      return;
    }

    let exiled = new Set<string>();

    this.people.forEach((person: PersonOrganization & Location) => {
      if (person.functions.map((f: any) => {
        if (!f.dateName) return; // someone forgot to add a date name
        return f.dateName.toLowerCase();
      }).includes('exil')) {
        exiled.add(person.objectId);
      }
    });

    let sortedMap = [...this.orderingMap.get(this.currentOrder).entries()]
      .sort((a: any, b: any) => {
        return a[1] - b[1];
      }).map((d: any) => { return d[0]; });

    this.renderRadial(this.data.filter((d: any) => {
      if (exiled.has(d.personID)) return d;
    }).sort((a: any, b: any) => {
      return sortedMap.indexOf(a.personID) - sortedMap.indexOf(b.personID);
    }), { order: true });
  }

  /**
   * Updates the ordering strategy
   * Get the selected ordering strategy and propagate new order to the 
   * dataset then call render to update changes.
   */
  updateOrder(): void {
    let sortedMap = [...this.orderingMap.get(this.currentOrder).entries()]
      .sort((a: any, b: any) => {
        return a[1] - b[1];
      }).map((d: any) => { return d[0]; });

    let update = {
      order: true
    };

    // if a grouping is selected preserve it
    if (this.currentGrouping !== 'None') update['group'] = true;

    this.renderRadial(this.data.sort((a: any, b: any) => {
      return sortedMap.indexOf(a.personID) - sortedMap.indexOf(b.personID);
    }), update);
  }

  /**
   * Updates the grouping strategy
   * Get the selected ordering strategy and apply a grouping 
   * If 'None' is selected revert to default ordering
   */
  updateGroup(): void {
    // update the categorical attribute of people
    // used by the categoricalArc in the renderRadial() function
    this.people.forEach((p: PersonOrganization & Location) => {
      (p as any).category = this.getCategory(p, this.currentGrouping);
    });

    if (this.currentGrouping === 'None') {
      this.updateOrder();
      return;
    }
    let sortedMap = [...this.orderingMap.get(this.currentOrder).entries()]
      .sort((a: any, b: any) => {
        return a[1] - b[1];
      }).map((d: any) => { return d[0]; });

    this.renderRadial(this.data.sort((a: any, b: any) => {
      return sortedMap.indexOf(a.personID) - sortedMap.indexOf(b.personID);
    }), { order: true, group: true }); // full update (order needs to be true to update the personAngleMap)
  }

  prepareLocationData(): void {
    let themeID = '';
    this.db.getEventsByLocations().then((success: Array<{ location: Location, events: Array<Event> }>) => {
      let locations: Array<PersonOrganization & Location> = success.map((s: { location: PersonOrganization & Location, events: Array<Event> }) => { return s.location; });
      this.people = locations;
      success.forEach((s: { location: Location, events: Array<Event> }) => {
        (s.location as any).category = s.location.locationTypes[0] ? s.location.locationTypes[0] : '?'
        console.log(s.location);
        s.events.forEach((e: Event) => {
          // add events to this.data as data points
          // TODO: categorical attribute
          // TODO: role attribute?
          let dataPoint: any = {};
          if (!e.startDate) return;
          dataPoint.startDate = moment(e.startDate);
          dataPoint.endDate = e.endDate ? moment(e.endDate) : moment(e.startDate);
          dataPoint.person = s.location.name;
          dataPoint.dateID = e.objectId;
          dataPoint.personCategory = s.location.locationTypes[0] ? s.location.locationTypes[0] : '?';
          dataPoint.dateName = e.name;
          dataPoint.personID = s.location.objectId;
          dataPoint.category = s.location.locationTypes[0] ? s.location.locationTypes[0] : 'none'; // TODO: should be event categorical type
          dataPoint.color = dataPoint.category; // default: none // TODO: should be colorcoded according to the category
          this.data.push(dataPoint);
        });
      });

      this.calculateScales();
      // create timeline
      this.createTimeline();
      console.log(this.orderingMap);
      // populate timeline(s)
      //TODO: Define ordering and grouping criteria for locations
      let sortedMap = [...this.orderingMap.get(this.currentOrder).entries()]
        .sort((a: any, b: any) => {
          return a[1] - b[1];
        }).map((d: any) => { return d[0]; });

      this.data = this.data.sort((a: any, b: any) => {
        return sortedMap.indexOf(a.personID) - sortedMap.indexOf(b.personID);
      });
      document.addEventListener('resize', this.onResize.bind(this));

      if(this.preset) {
        this.updateConfig();
      } else {
      this.renderRadial(this.data);
      this.renderChart(this.data);
      }
    });
  }

  /**
   * Called once the DatabaseService resolves with people/organizations
   * - Populates the @property people array 
   * - Parses the functions and dates array for each person
   * - Formats data so we can use it easily with d3
   */
  prepareData(): void {
    let themeID = '5be942be2447d22473b2e80c'; // festwochen'5d949c5334492200a542f2e3'; // 1. mai '5d94990f34492200a542f2da'// mdt '5be942be2447d22473b2e80c'; 
    this.db.getPeopleByTheme(themeID).then((success) => {
      this.people = success;
      let roles = new Set<string>();
      let themePromiseEventArray = new Array<Promise<any>>();
      success.forEach((person: any) => {
        person.roles.forEach((r: any) => {
          roles.add(r);
        });
        person.category = this.getCategory(person, this.currentGrouping);
        themePromiseEventArray.push(
          this.db.getEventsByPersonOrganization(person)
            .then((eventsByPerson: Array<Event>) => {
              let events = new Set<Event>();
              eventsByPerson.forEach((event: Event) => {
                event.themes.forEach((theme: any) => {
                  if (theme.theme === themeID) events.add(event);
                });
              });

              return {
                person: person,
                events: Array.from(events)
              };
            })
        );
      });

      Promise.all(themePromiseEventArray).then((peopleEvents: Array<any>) => {
        // populate map
        peopleEvents.forEach((personEvents: any) => {
          let person = personEvents.person;
          // person.category = this.getRandomCategory();
          let events = personEvents.events;
          let functions = person.functions.filter((d: any) => { return d.dateName !== null; }); // return non-null datenames
          // if(!functions.map((d: any) => { return d.dateName.toLowerCase(); }).includes('exil')) return; // only display exiled people
          if (person.functions) {
            // functions
            person.functions.forEach((func: any) => {
              let dataPoint: any = {};
              if (!func.startDate) return;
              dataPoint.startDate = moment(func.startDate);
              dataPoint.endDate = func.endDate ? moment(func.endDate) : moment(func.startDate);
              dataPoint.person = person.name;
              dataPoint.dateID = func._id;
              dataPoint.personCategory = person.category;
              dataPoint.dateName = func.dateName;
              dataPoint.personID = person.objectId;
              // dataPoint.category = this.getRandomCategory();
              dataPoint.color = this.getEventType(func.dateName ? func.dateName : '');
              this.data.push(dataPoint);
            });

            // other dates
            person.dates.forEach((date: any) => {
              if (date.dateName === 'Birth') {
                this.orderingMap.get('Birth').set(person.objectId, moment(date.date));
              }
              if (date.dateName === 'Death') {
                this.orderingMap.get('Death').set(person.objectId, moment(date.date));
              }
              let dataPoint: any = {};
              dataPoint.startDate = moment(date.date);
              dataPoint.endDate = moment(date.date);
              dataPoint.dateID = date._id;
              dataPoint.dateName = date.dateName;
              dataPoint.person = person.name;
              dataPoint.personCategory = person.category;
              dataPoint.personID = person.objectId;
              // dataPoint.category = this.getRandomCategory();
              dataPoint.color = this.getEventType(date.dateName ? date.dateName : '');
              this.data.push(dataPoint);
            });
          }
          this.addEventsToPerson(person, events);
        });

        this.orderingMap.get('First Post-death Event').forEach((value: any, key: string) => {
          let deathDate = this.orderingMap.get('Death').get(key);
          this.orderingMap.get('Honoring Time').set(key, deathDate - value);
        });
        let sortedMap = [...this.orderingMap.get(this.currentOrder).entries()]
          .sort((a: any, b: any) => {
            return a[1] - b[1];
          }).map((d: any) => { return d[0]; });
        // // calculate extent and scales
        this.calculateScales();
        // create timeline
        this.createTimeline();
        // populate timeline(s)
        //TODO: Improve dataset to filter more people

        this.data = this.data.sort((a: any, b: any) => {
          return sortedMap.indexOf(a.personID) - sortedMap.indexOf(b.personID);
        });
        document.addEventListener('resize', this.onResize.bind(this));


          if(this.preset) {
            this.updateConfig();
          } else {
        this.renderRadial(this.data);
        this.renderChart(this.data);
          }
      });
    });
  }

  /**
   * Get config from db setup parameters and update the visualization
   */
  updateConfig(): void {
    this.db.getSnapshot(this.preset).then((success: any) => {
      let parameters = JSON.parse(success.parameters);
      this.selectedPerson = parameters.selectedPerson;
      this.currentOrder = parameters.currentOrder;
      this.currentGrouping = parameters.currentGrouping;
      this.currentlySelectedMinDate = moment(parameters.currentlySelectedMinDate).toDate();
      this.currentlySelectedMaxDate = moment(parameters.currentlySelectedMaxDate).toDate();
      this.mouseBehavior = parameters.mouseBehavior;
      this.brushBehavior = parameters.brushBehavior;
      this.currentFilter = parameters.filter;
      
      let sortedMap = [...this.orderingMap.get(this.currentOrder).entries()]
        .sort((a: any, b: any) => {
          return a[1] - b[1];
        }).map((d: any) => { return d[0]; });
      this.data = this.data.sort((a: any, b: any) => {
        return sortedMap.indexOf(a.personID) - sortedMap.indexOf(b.personID);
      });
      
      this.renderRadial(this.data, { order: true, group: true });
      this.renderChart(this.data);
      // this.renderChart(this.data);
      // filter
      this.filterEventsByType(this.currentFilter);
      // set chart brush
      this.setChartBrush(this.currentlySelectedMinDate, this.currentlySelectedMaxDate);
      // set rad brush
      this.drawDonut(this.rScale(this.currentlySelectedMinDate), this.rScale(this.currentlySelectedMaxDate));
      // set brush behavior
      this.brushBehavior ? this.showBrush() : this.hideBrush();
      if(this.selectedPerson) this.highlightPerson(this.selectedPerson.name)
    });
  }

  onResize(): void {
    console.log('resized');
    //TODO: implement
  }

  updateConfig(): void {
    // TODO: parse preset and update vis
  }

  copyToClipBoard(item: string): void {
    document.addEventListener('copy', ($event: any) => {
      $event.clipboardData.setData('text/plain', item);
      $event.preventDefault();
      document.removeEventListener('copy', null);
    });

    document.execCommand('copy');
  }

  /**
   * Calculates the scales that are needed to map data to space
   * based on the width and height for the visualization
   * @param width visualization width
   * @param height visualization height
   */
  calculateScales(width?: number, height?: number): void {
    this.WIDTH = width ? width : this.timelineRadial.nativeElement.clientWidth;
    this.HEIGHT = height ? height : this.timelineRadial.nativeElement.clientHeight;

    // our temporal range based on the data

    this.MIN_DATE = d3.min(this.data.map((d: any) => {
      return moment(d.startDate, ['YYYY-MM-DD',]);
    }));
    // this.MIN_DATE = moment('1938-01-01', 'YYYY-MM-DD');
    this.MAX_DATE = moment(); // d3.max(this.data.map((d: any) => { return moment(d.endDate, ['YYYY-MM-DD']); })); 

    this.xScale = d3.scaleTime()
      .domain([this.MIN_DATE, this.MAX_DATE])
      .range([0, (this.WIDTH - (this.margin.left + this.margin.right))]);

    this.yScale = d3.scaleLinear()
      .range([0, (this.HEIGHT - (this.margin.top + this.margin.bottom))]);

    // rScale range starts from 50 to create an empty hole at the center
    this.rScale = d3.scaleTime()
      .domain([this.MIN_DATE, this.MAX_DATE])
      .range([50, Math.min((this.WIDTH - (this.margin.left + this.margin.right) / 2), (this.HEIGHT - (this.margin.top + this.margin.bottom)) / 2)]);

    this.angleScale = d3.scaleLinear().range([0, 360]); // circle 0-360 degrees
  }

  saveConfig($event: any): void {
    let item = {
      selectedPerson: this.selectedPerson,
      currentOrder: this.currentOrder,
      currentGrouping: this.currentGrouping,
      currentlySelectedMinDate: this.currentlySelectedMinDate,
      currentlySelectedMaxDate: this.currentlySelectedMaxDate,
      mouseBehavior: this.mouseBehavior,
      brushBehavior: this.brushBehavior,
      filter: this.currentFilter
      // showList: this.sh
    };
    this.db.saveSnapshot(JSON.stringify(item)).then((response: any) => {
      let url = `${environment.APP_URL}${_VIS}/${response._id}`;
      this.configInput.nativeElement.value = url;
      this.copyToClipBoard(`${url}?dataType=${this.dataType}`);
    });
  }



  /**
   * Returns the x-coordinate based on the date (radius) and angle (theta)
   * @param date date object of a specific event
   * @param angle angle of the persons timeline
   */
  getXCoordinates(date: Date, angle: number): number {
    return Math.cos(angle) * this.rScale(date);
  }

  /**
   * Returns the y-coordinate based on the date (radius) and angle (theta)
   * @param date date object of a specific event
   * @param angle angle of the persons timeline
   */
  getYCoordinates(date: Date, angle: number): number {
    return Math.sin(angle) * this.rScale(date);
  }

  /**
   * Open up sidepanel to display a persons details, including
   * events / other people related to them
   * @param name the persons name
   */
  displayPersonDetails(name: string): void {
    this.personSelected = true;
    this.selectedPerson = this.people.find((p: PersonOrganization & Location) => { return p.name === name; });
    this.spinTo(); // notify that we have opened the side panel
  }

  /**
   * Closes the sidepanel
   */
  closePersonDetails(): void {
    this.personSelected = false;
    this.selectedPerson = undefined;
    this.spinTo(true); // notify that we have closed the side panel
  }

  /**
   * Creates the timeline SVG 
   * Creates d3 zoom behavior 
   * Creates d3 brush behavior
   */
  createTimeline(): void {
    // get the x,y scales so we can draw things
    this.timelineSVG = d3.select(this.timelineRadial.nativeElement)
      .append('svg')
      .style('overflow', 'visible')
      .attr('width', this.WIDTH)
      .attr('height', this.HEIGHT);

    // .attr('viewBox', `${-this.WIDTH / 2} ${-this.HEIGHT / 2} ${this.WIDTH} ${this.HEIGHT}`)
    this.WIDTH = this.WIDTH - (this.margin.left + this.margin.right);
    this.HEIGHT = this.HEIGHT - (this.margin.top + this.margin.bottom);
    // group for data
    let g = this.timelineSVG.append('g')
      .attr('width', this.WIDTH)
      .attr('height', this.HEIGHT)
      .attr('transform', `translate(${this.WIDTH / 2}, ${this.rScale.range()[1]})`);

    this.radialG = g.append('g')
      .attr('width', this.WIDTH)
      .attr('height', this.HEIGHT)
      .attr('transform', `translate(${this.margin.top}, ${this.margin.left})`);

    // set display range
    this.currentlySelectedMinDate = this.MIN_DATE.toDate();
    this.currentlySelectedMaxDate = this.MAX_DATE.toDate();

    this.timeChartSVG = d3.select(this.timelineChart.nativeElement)
      .append('svg')
      .attr('width', this.timelineChart.nativeElement.clientWidth)
      .attr('height', 200) // 200px
      .attr('fill', 'transparent');

    this.radialG.append('circle')
      .attr('class', 'circle-grid')
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('r', 0);

    this.radialG
      .append('text')
      .attr('class', 'text-inside')
      .attr('text-anchor', 'middle')
      .attr('opacity', 0)
      .attr('x', 0)
      .attr('y', 0)
      .attr('dy', '.4em')
      .style('font-size', '25px')
      .text('');

    this.timelineSVG.on('mousemove', (d: any) => {
      this.drawGridCircle();
    });

    this.legendSVG = this.radialG.append('g')
      .attr('class', 'legend')
      .attr('transform', 'translate(1350, -40)');

    // add radial brush
    this.radialG.append('path').attr('class', 'radial-brush');

    this.radialG.append('circle')
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('r', () => { return Math.abs(this.rScale(moment('1945').toDate())); })
      .attr('stroke', '#777777')
      .attr('stroke-width', '4px')
      .attr('fill', 'none');
  }

  /**
   * Draws the outer donut of the circle used to encode categorical data
   * We draw it stepwise by angle intervals
   * @param startRadius starting angle of the arc
   * @param endRadius ending angle of the arc
   */
  drawDonut(startRadius: number, endRadius: number): void {
    // this.radialG.select('#arc-selection').remove();

    if (!this.arc) this.arc = d3.arc();

    this.arc
      .innerRadius(startRadius)
      .outerRadius(endRadius)
      .startAngle(0)
      .endAngle(2 * Math.PI);


    d3.select('.radial-brush')
      .transition().duration(0)
      .attr('d', this.arc)
      .attr('fill', '#4286f4')
      .attr('fill-opacity', '.15')
      .attr('stroke', '#fff')
      .attr('stroke-opacity', '1')
      .attr('stroke-width', '2px')
      .attr('id', 'arc-selection');
    // .lower();
    // .attr('')
    // .attr('transform', 'translate(200,200)')
  }

  /**
   * Clears the radial and timeline brush 
   * Resets the currently selected min and max dates back to default
   */
  clearTimeSelection() {
    d3.select('.brush').call(this.chartBrush.move, null);
    this.drawDonut(null, null);

    this.currentlySelectedMaxDate = this.MAX_DATE.toDate();
    this.currentlySelectedMinDate = this.MIN_DATE.toDate();

    this.radialG.selectAll('.category')
      .transition()
      .duration(250)
      .attr('opacity', 1);

    this.radialG.selectAll('.event') // after death / event line
      .transition()
      .duration(250)
      .attr('stroke', (d: any) => { return this.colors(d.color); })
      .attr('opacity', 1);

    this.radialG.selectAll('.before-death')
      .transition()
      .duration(250)
      .attr('stroke', '#A5F0D6')
      .attr('opacity', 1);

    this.chartG.selectAll('.dots')
      .transition()
      .duration(250)
      .attr('opacity', 1)
      .attr('fill', (d: any) => { return this.colors(d.color); });

    d3.select('#count-tooltip')
      .style('opacity', 0)
      .html('');
  }

  /**
   * Gets a list of people in the selected date range
   */
  getList(): void {
    this.showingList = true;
    let start = this.currentlySelectedMinDate ? this.currentlySelectedMinDate : this.MIN_DATE.toDate();
    let end = this.currentlySelectedMaxDate ? this.currentlySelectedMaxDate : this.MAX_DATE.toDate();
    this.getDataInRange(start, end);
  }

  /**
   * Clears the list of currently selected people
   * based on the temporal selection
   */
  clearList(): void {
    this.showingList = false;
    this.currentlySelectedPeople = new Array<any>();
  }

  showBrush(): void {
    d3.select('.selection').style('opacity', 1).raise();
    d3.select('.radial-brush').style('opacity', 1).raise();
  }

  hideBrush(): void {
    d3.select('.selection').style('opacity', 0).lower();
    d3.select('.radial-brush').style('opacity', 0).lower();
  }

  toggleBrushBehavior(): void {
    this.brushBehavior = !this.brushBehavior;

    this.brushBehavior ? this.showBrush() : this.hideBrush();
  }

  toggleMouseBehavior(): void {
    this.mouseBehavior = !this.mouseBehavior;
    this.radialG.select('.circle-grid').attr('opacity', () => { return this.mouseBehavior ? 1 : 0; });
    this.radialG.select('.text-inside').attr('opacity', () => { return this.mouseBehavior ? 1 : 0; });
  }

  toggleNames(): void {
    this.showNames = !this.showNames;
    this.radialG.selectAll('.person-name').attr('opacity', () => { return this.showNames ? 1 : 0; });
  }

  /**
   * Drag start event handler
   */
  radialDragStart(): void {
    let mouseClickX = (d3.event.x - (this.WIDTH + (this.margin.left + this.margin.right)) / 2);
    let mouseClickY = (d3.event.y - (this.HEIGHT + (this.margin.top + this.margin.bottom)) / 2);

    let sqrt = Math.ceil(Math.sqrt(mouseClickX * mouseClickX +
      mouseClickY * mouseClickY));

    let date = moment(this.rScale.invert(sqrt));

    if (date.isBefore(this.MIN_DATE)) sqrt = this.rScale(this.MIN_DATE);
    if (date.isAfter(this.MAX_DATE)) sqrt = this.rScale(this.MAX_DATE);
    this.dragStartPoint = sqrt;
  }

  /**
   * Dragging event handler
   */
  radialDragging(): void {
    let mouseClickX = (d3.event.x - (this.WIDTH + (this.margin.left + this.margin.right)) / 2);
    let mouseClickY = (d3.event.y - (this.HEIGHT + (this.margin.top + this.margin.bottom)) / 2);

    let sqrt = Math.ceil(Math.sqrt(mouseClickX * mouseClickX + mouseClickY * mouseClickY));

    let date = moment(this.rScale.invert(sqrt));

    if (date.isAfter(this.MAX_DATE)) sqrt = this.rScale(this.MAX_DATE);
    if (date.isBefore(this.MIN_DATE)) sqrt = this.rScale(this.MIN_DATE);
    this.dragEndPoint = sqrt;

    let tmpStart = this.dragStartPoint;
    let tmpEnd = this.dragEndPoint;

    if (tmpStart > tmpEnd) {
      let tmp = tmpStart;
      tmpStart = tmpEnd;
      tmpEnd = tmp;
    }

    let startDate = this.rScale.invert(tmpStart);
    let endDate = this.rScale.invert(tmpEnd);

    if (moment(startDate).isBefore(this.MIN_DATE)) {
      tmpStart = this.rScale(this.MIN_DATE);
    }

    if (moment(endDate).isAfter(this.MAX_DATE)) {
      tmpEnd = this.rScale(this.MAX_DATE);
    }

    this.currentlySelectedMinDate = this.rScale.invert(tmpStart);
    this.currentlySelectedMaxDate = this.rScale.invert(tmpEnd);

    this.drawDonut(tmpStart, tmpEnd);

    this.setChartBrush(startDate, endDate);

  }

  /**
   * Drag end event handler
   */
  radialDragEnd(): void {
    this.dragStartPoint = 0;
    this.dragEndPoint = 0;
  }

  /**
   * Returns data points that fall into the provided date range
   * @param start start of the date range
   * @param end end of the date range
   */
  getDataInRange(start: Date, end: Date): void {
    this.dataInRange = new Array<any>();
    // let people = new Set<any>();

    this.data.forEach((d: any) => {
      if (d.startDate.isAfter(start) && d.endDate.isBefore(end)) {
        this.dataInRange.push(d);
        // people.add(d.person);
      }
    });

    this.currentlySelectedEvents = this.dataInRange;

    // get sorted list of events by person descending
    let eventsByPeople = d3.nest()
      .key((d: any) => {
        return d.person;
      })
      .entries(this.dataInRange)
      .sort((a: any, b: any) => {
        return a.values.length - b.values.length;
      })
      .reverse()
      .map((d: any) => { return { name: d.key, events: d.values.sort((a, b) => { return a.startDate - b.startDate; }) }; });
    // return events by people (people sorted by #events; events sorted chronologically)
    this.currentlySelectedPeople = eventsByPeople;

    let peopleNamesInRange = new Set<string>();
    // also highlight the people in the vis
    this.radialG.selectAll('.event') // after death / event line
      .transition()
      .duration(250)
      .attr('stroke', (d: any) => {
        if (d.startDate.isBetween(start, end, 'year')) {
          peopleNamesInRange.add(d.person);
        }
        return d.startDate.isBetween(start, end, 'year') ? this.colors(d.color) : '#777777';
      })
      .attr('opacity', (d: any) => {
        return d.startDate.isBetween(start, end, 'year') ? 1 : .25;
      });

    this.radialG.selectAll('.person-name')
      .attr('opacity', (d: any) => {
        if (!this.showNames) return 0;
        return peopleNamesInRange.has(d.key) ? 1 : 0;
      });

    this.radialG.selectAll('.category')
      .attr('opacity', (d: any) => {
        return peopleNamesInRange.has(d.key) ? 1 : 0;
      });

    this.radialG.selectAll('.before-death')
      .transition()
      .duration(250)
      .attr('stroke', (d: any) => {
        // find bday
        let bday = d.values.filter((dd: any) => { return dd.dateName === 'Birth'; })[0];
        if (bday && bday.startDate) {
          return bday.startDate.isBetween(start, end, 'year') ? '#A5F0D6' : '#777777';
        } else {
          return '#A5F0D6';
        }
      })
      .attr('opacity', (d: any) => {
        // find bday
        let bday = d.values.filter((dd: any) => { return dd.dateName === 'Birth'; })[0];
        if (bday && bday.startDate) {
          return bday.startDate.isBetween(start, end, 'year') ? 1 : .25;
        } else {
          return 1;
        }
      });

    this.chartG.selectAll('.dots')
      .transition()
      .duration(250)
      .attr('fill', (d: any) => {
        return d.startDate.isBetween(start, end, 'year') ? this.colors(d.color) : '#777777';
      }).attr('opacity', (d: any) => {
        return d.startDate.isBetween(start, end, 'year') ? 1 : .25;
      });
  }

  /**
   * Should allow the user to drag and drop timlines to manually set the order
   * TODO: Implement / Fix this function
   */
  // doReorder(d: any, i: number, n: any): void {
  //   // do math
  //   let radius = this.rScale((moment(this.rScale.domain()[1]).add(10, 'years')));
  //   let coords = d3.mouse(this.timelineContainer.nativeElement);
  //   let x = coords[0] - (radius + this.margin.left/2);
  //   let y = coords[1] - (radius + this.margin.top/2);
  //   // calculate angle
  //   let angle = Math.atan2(y, x);
  //   // set coordinates
  //   d3.select(n[i])
  //     .transition().duration(50)
  //     .attr('r', 10)
  //     .attr('fill', '#000')
  //     .attr('opacity', 1)
  //     .attr('cx', () => { return Math.cos(angle)*radius; })
  //     .attr('cy', () => { return Math.sin(angle)*radius; });
  // }

  // endReoder(d: any, i: number, n: any): void {
  //   console.log(d);
  //   // do math
  //   let radius = this.rScale((moment(this.rScale.domain()[1]).add(10, 'years')));
  //   let coords = d3.mouse(this.timelineContainer.nativeElement);
  //   let x = coords[0] - (radius + this.margin.left/2);
  //   let y = coords[1] - (radius + this.margin.top/2);

  //   let angle = Math.atan2(y, x);
  //   angle = (angle*180/Math.PI + 360) % 360; // convert to degrees cap in [0, 360]

  //   // get current ordering
  //   let sortedMap = [...this.orderingMap.get(this.currentOrder).entries()]
  //                   .sort((a: any, b: any) => {
  //                     return a[1] - b[1];
  //                   }).map((d: any) => { return d[0]; });

  //   // swap indices
  //   let personDrag = this.people.find((p: PersonOrganization) => { return p.name.trim() === d.trim(); });
  //   // console.log(personDrag);
  //   let pickIdx = sortedMap.indexOf(personDrag.objectId);
  //   // console.log(sortedMap);
  //   let dropIdx = Math.floor(angle/(this.theta*180/Math.PI)); // in degrees
  //   let personDrop = this.people.find((p: PersonOrganization) => { return sortedMap[dropIdx] === p.objectId; });

  //   console.log(pickIdx, personDrag.name, dropIdx, personDrop.name);

  //   sortedMap.splice(pickIdx, 1);
  //   // if(pickIdx < dropIdx) dropIdx--;

  //   sortedMap.splice(dropIdx, 0, personDrop.objectId);

  //   this.render(this.data.sort((a: any, b: any) => {
  //     return sortedMap.indexOf(a.personID) - sortedMap.indexOf(b.personID);
  //   }), true);
  // }

  /**
   * De-selects the selected person (highlighted)
   */
  unhighlightPerson(): void {
    let beforeDeathLines = this.radialG.selectAll('.before-death');
    beforeDeathLines
      .transition().duration(250)
      .attr('stroke-opacity', 1);

    let eventLines = this.radialG.selectAll('.event')
    eventLines
      .transition().duration(250)
      .attr('stroke-opacity', (d: any) => {
        d.hidden = false;
        return 1;
      });

    let categoricalBars = this.radialG.selectAll('.category');
    categoricalBars
      .transition().duration(250)
      .attr('opacity', (d: any) => {
        d.hidden = false;
        return 1;
      });

    let peopleNames = this.radialG.selectAll('.person-name');
    peopleNames
      .transition().duration(250)
      .attr('opacity', (d: any) => {
        d.hidden = false;
        return 1;
      })
      .attr('transform', (d: any, i: number) => {
        let rotate = (this.theta * i * 180 / Math.PI);
        let today = moment();
        let radius = this.rScale(today.add(25, 'years').toDate()); // 8 year offset for text from outer circle
        let flip = (rotate > 90 && rotate < 270) ? 180 : 0;
        let offset = (rotate > 90 && rotate < 270) ? -1 : .5; // correct offset
        return `rotate(${rotate + offset}) translate(${radius}) rotate(${flip})`;
      })
      .style('text-anchor', (d: any, i: number) => {
        let rotate = (this.theta * i * 180 / Math.PI);
        return (rotate > 90 && rotate < 270) ? 'end' : 'start';
      });

    let timelineDots = this.chartG.selectAll('.dots');
    timelineDots
      .transition().duration(250)
      .attr('opacity', (d: any) => { return 1; });

    let dots = this.legendSVG.selectAll('.dots');
    dots
      .transition().duration(250)
      .attr('opacity', 1);

    let labels = this.legendSVG.selectAll('.labels');
    labels
      .transition().duration(250)
      .attr('opacity', 1);

    let gridLines = this.radialG.selectAll('.grid-line');
    gridLines
      .transition().duration(250)
      .attr('opacity', 1);
  }

  /**
   * Hightlights (selects) a person
   * @param name person to highlight
   */
  highlightPerson(name: string): void {
    let beforeDeathLines = this.radialG.selectAll('.before-death');
    beforeDeathLines
      .transition().duration(250)
      .attr('stroke-opacity', (d: any) => {
        d.hidden = d.key !== name ? true : false;
        return d.key !== name ? 0 : 1;
      });

    let listOfDates = new Array<any>();
    let eventLines = this.radialG.selectAll('.event');
    eventLines
      .transition().duration(250)
      .attr('stroke-opacity', (d: any) => {
        if (d.person === name) listOfDates.push(d);
        d.hidden = d.person !== name ? true : false;
        return d.person !== name ? 0 : 1;
      });
    listOfDates.sort((a: any, b: any) => {
      return a.startDate.valueOf() - b.startDate.valueOf();
    });
    // TODO: see if we can space out overlapping events by evaluating overlaps in the listOfDates array
    // and offset them in x,y - radially
    // eventLines
    //   .transition().duration(250)
    //   .attr('')

    let categoricalBars = this.radialG.selectAll('.category');
    categoricalBars
      .transition().duration(250)
      .attr('opacity', (d: any) => {
        d.hidden = d.key !== name ? true : false;
        return d.key !== name ? 0 : 1;
      });

    let peopleNames = this.radialG.selectAll('.person-name');
    peopleNames
      .transition().duration(250)
      .attr('opacity', (d: any) => { return d.key !== name ? 0 : 1; })
      .attr('transform', (d: any, i: number) => {
        let rotate = (this.theta * i * 180 / Math.PI);
        let today = moment();
        let radius = this.rScale(today.add(25, 'years').toDate()); // 8 year offset for text from outer circle
        let flip = 180;  // reverse flip
        let offset = -.5; // reverse offset
        return `rotate(${rotate + offset}) translate(${radius}) rotate(${flip})`;
      })
      .style('text-anchor', (d: any, i: number) => {
        return 'end'; // reverse anchor
      });

    let timelineDots = this.chartG.selectAll('.dots');
    timelineDots
      .transition().duration(250)
      .attr('opacity', (d: any) => {
        return d.person === name ? 1 : 0;
      });

    let dots = this.legendSVG.selectAll('.dots');
    dots
      .transition().duration(250)
      .attr('opacity', 0);

    let labels = this.legendSVG.selectAll('.labels');
    labels
      .transition().duration(250)
      .attr('opacity', 0);

    let gridLines = this.radialG.selectAll('.grid-line');
    gridLines
      .transition().duration(250)
      .attr('opacity', 0);
    // TODO: Highlight events in timeline 
  }

  /**
   * Mouseover handler for the circle axis grid
   */
  drawGridCircle(): void {
    if (!this.mouseBehavior) return;
    let mouseX = (d3.event.x - (this.WIDTH + (this.margin.left + this.margin.right)) / 2);
    let mouseY = (d3.event.y - (this.HEIGHT + (this.margin.top + this.margin.bottom)) / 2);

    let radius = Math.ceil(Math.sqrt(mouseX * mouseX + mouseY * mouseY));
    let date = this.rScale.invert(radius);


    if (moment(date).isBefore(this.MIN_DATE)) date = this.MIN_DATE.toDate();
    if (moment(date).isAfter(this.MAX_DATE)) date = this.MAX_DATE.toDate();

    radius = this.rScale(date);

    this.radialG.select('.circle-grid')
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('r', radius)
      .attr('stroke-width', '2px')
      .attr('stroke', '#777777')
      .attr('fill', 'none')
      .raise(); //bring it up

    this.radialG.select('.text-inside')
      .attr('opacity', 1)
      .text(`${moment(date).year()}`);
  }


  /**
   * Creates the 'timelines' and plots them on the timeline
   * Timelines consist of three parts:
   * - Life span - defined as line with the class '.before-death'
   * - Post life span - defined as a dashed line with the class '.after-death'
   * - Events - lines / circles plotted on the timelines with the class '.event'
   */
  renderRadial(data: Array<any>, update?: any): void {
    let personNameArray = new Set<string>();
    let dataByPerson = d3.nest()
      .key((d: any) => {
        if (!personNameArray.has(d.person)) personNameArray.add(d.person);
        return d.person;
      })
      .entries(data);

    if (update && update.group) {
      dataByPerson.sort((a: any, b: any) => {
        let personA = this.people.find((p: PersonOrganization & Location) => { return p.name === a.key; });
        let personB = this.people.find((p: PersonOrganization & Location) => { return p.name === b.key; });
        let catA = this.getCategory(personA, this.currentGrouping);
        let catB = this.getCategory(personB, this.currentGrouping);
        return catA.localeCompare(catB);
      });
    }
    this.theta = 2 * Math.PI / dataByPerson.length;

    this.timelineSVG.call(
      d3.drag()
        .on('start', () => { this.radialDragStart(); })
        .on('drag', () => { this.radialDragging(); })
        .on('end', () => { this.radialDragEnd(); })
    );

    let temporalData = d3.timeYear.range(this.MIN_DATE.toDate(), this.MAX_DATE.toDate(), 10);
    temporalData.push(moment('01-01-1945').toDate());

    let gridLines = this.radialG.selectAll('.grid-line').data(dataByPerson);

    gridLines
      .enter()
      .append('line')
      .attr('class', 'grid-line')
      .attr('stroke', '#e3e3e3')
      .attr('stroke-width', 1)
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', 0)
      .attr('y2', 0)
      .merge(gridLines)
      .transition().duration(250)
      .attr('x1', (d: any, i: number) => {
        return this.getXCoordinates(this.MIN_DATE.toDate(), i * this.theta);
      })
      .attr('x2', (d: any, i: number) => {
        return this.getXCoordinates(this.MAX_DATE.toDate(), i * this.theta);
      })
      .attr('y1', (d: any, i: number) => {
        return this.getYCoordinates(this.MIN_DATE.toDate(), i * this.theta);
      })
      .attr('y2', (d: any, i: number) => {
        return this.getYCoordinates(this.MAX_DATE.toDate(), i * this.theta);
      })


    let beforeDeathLines = this.radialG.selectAll('.before-death').data(dataByPerson);
    beforeDeathLines
      .enter()
      .append('line')
      .attr('class', 'before-death')
      .attr('stroke', '#A5F0D6')
      .attr('stroke-width', 8)
      .attr('x1', (d: any, i: number, n: any) => {
        let x1 = d3.select(n[i]).attr('x1');
        return x1 ? x1 : 0;
      })
      .attr('x2', (d: any, i: number, n: any) => {
        let x2 = d3.select(n[i]).attr('x2');
        return x2 ? x2 : 0;
      })
      .attr('y1', (d: any, i: number, n: any) => {
        let y1 = d3.select(n[i]).attr('y1');
        return y1 ? y1 : 0;
      })
      .attr('y2', (d: any, i: number, n: any) => {
        let y2 = d3.select(n[i]).attr('y2');
        return y2 ? y2 : 0;
      })
      .on('mouseover', (d: any) => {
        if (d.hidden) return;
        // if filter selected and object not of filter type - no interaction
        if (this.beingFiltered && this.currentFilter !== d.color) return;

        let birthDate = d.values.find((dd: any) => { return dd.dateName === 'Birth'; });
        let deathDate = d.values.find((dd: any) => { return dd.dateName === 'Death'; });
        if (birthDate) birthDate = birthDate.startDate;
        if (deathDate) deathDate = deathDate.startDate;
        let age = Math.abs((birthDate ? birthDate : moment()).diff(deathDate ? deathDate : moment(), 'years'));
        let person = this.people.find((p: PersonOrganization & Location) => { return p.name === d.key; });
        let artistName = '';
        person.names.forEach((name: any) => {
          if (name.nameType === 'Showbiz Name') artistName = name.name;
        });

        this.tooltip.nativeElement.style.display = 'block';
        this.tooltip.nativeElement.style.top = `${d3.event.pageY}px`;
        this.tooltip.nativeElement.style.left = `${d3.event.pageX + 20}px`;
        this.tooltip.nativeElement.innerHTML = `
              <h3>${artistName !== '' ? artistName : d.key} (${age})</h3>
              ${artistName !== '' ? `<span class="aka">a.k.a. ${d.key}</span>` : ''}
              <p>Born: ${moment(birthDate).format('DD/MM/YYYY')} ${deathDate ? ` - Died: ${moment(deathDate).format('DD/MM/YYYY')}` : ''}</p>
            `;
      })
      .on('mouseout', () => {
        this.tooltip.nativeElement.style.display = 'none';
        this.tooltip.nativeElement.innerHTML = '';
      })
      .merge(beforeDeathLines)
      .transition().duration(250)
      .attr('stroke', (d: any, i: number) => {
        return '#A5F0D6';
      })
      .attr('x1', (d: any, i: number) => {
        if (!this.peopleAngles.has(d.key)) this.peopleAngles.set(d.key, i * this.theta);
        if (update && update.order) this.peopleAngles.set(d.key, i * this.theta);
        let birthDate = d.values.find((dd: any) => dd.dateName === 'Birth' ? dd : null);
        let date = birthDate ? birthDate.startDate : Date.now();
        return this.getXCoordinates(date, i * this.theta);
      })
      .attr('x2', (d: any, i: number) => {
        let deathDate = d.values.find((dd: any) => dd.dateName === 'Death' ? dd : null);
        let date = deathDate ? deathDate.endDate : Date.now();
        return this.getXCoordinates(date, i * this.theta);
      })
      .attr('y1', (d: any, i: number) => {
        let birthDate = d.values.find((dd: any) => dd.dateName === 'Birth' ? dd : null);
        let date = birthDate ? birthDate.startDate : Date.now();
        return this.getYCoordinates(date, i * this.theta);
      })
      .attr('y2', (d: any, i: number) => {
        let deathDate = d.values.find((dd: any) => dd.dateName === 'Death' ? dd : null);
        let date = deathDate ? deathDate.endDate : Date.now();
        return this.getYCoordinates(date, i * this.theta);
      });

    let eventLines = this.radialG.selectAll('.event').data(data);
    eventLines
      .enter()
      .append('line')
      .attr('class', 'event')
      .attr('stroke', '#cbeabb')
      .attr('stroke-width', '2px')
      .attr('stroke-linecap', 'round')
      .attr('stroke-opacity', 1)
      .attr('data-dateid', (d: any) => {
        return d.dateID;
      })
      .attr('x1', (d: any, i: number, n: any) => {
        let x1 = d3.select(n[i]).attr('x1');
        return x1 ? x1 : 0;
      })
      .attr('x2', (d: any, i: number, n: any) => {
        let x2 = d3.select(n[i]).attr('x2');
        return x2 ? x2 : 0;
      })
      .attr('y1', (d: any, i: number, n: any) => {
        let y1 = d3.select(n[i]).attr('y1');
        return y1 ? y1 : 0;
      })
      .attr('y2', (d: any, i: number, n: any) => {
        let y2 = d3.select(n[i]).attr('y2');
        return y2 ? y2 : 0;
      })
      .on('mouseover', (d: any, i: number, n: any) => {
        if (d.hidden) return;

        // if filter selected and object not of filter type - no interaction
        if (this.beingFiltered && this.currentFilter !== d.color) return;

        this.tooltip.nativeElement.style.display = 'block';
        this.tooltip.nativeElement.style.top = `${d3.event.pageY}px`;
        this.tooltip.nativeElement.style.left = `${d3.event.pageX + 20}px`;
        let person = this.people.find((p: PersonOrganization & Location) => { return p.name === d.person; });
        let artistName = '';
        person.names.forEach((name: any) => {
          if (name.nameType === 'Showbiz Name') artistName = name.name;
        });
        this.tooltip.nativeElement.innerHTML = `
              <h3>${artistName !== '' ? artistName : d.person}</h3>
              ${artistName !== '' ? `<span class="aka">a.k.a. ${person.name}</span>` : ''}
              <h4>${d.dateName}</h4>
              <p>${moment(d.startDate).format('DD/MM/YYYY')} ${moment(d.endDate).diff(moment(d.startDate), 'days') > 2 ? `- ${moment(d.endDate).format('DD/MM/YYYY')}` : ''}</p>
            `;
        this.handleMouseover(d.dateName, d.dateID, d.personID, d.person, true); // from rad
      })
      .on('mouseout', (d: any, i: number, n: any) => {
        this.tooltip.nativeElement.style.display = 'none';
        this.handleMouseout();
      })
      .merge(eventLines)
      .transition().duration(250)
      .attr('stroke-opacity', (d: any) => {
        return d.hidden ? 0 : 1;
      })
      .attr('stroke-width', '8px')
      .attr('stroke', (d: any) => { return this.colors(d.color); })
      // .attr('stroke', (d: any) => { return '#A5D5E6' })
      .attr('x1', (d: any, i: number) => { return this.getXCoordinates(d.startDate.toDate(), this.peopleAngles.get(d.person)); })
      .attr('x2', (d: any, i: number) => { return this.getXCoordinates(d.endDate.toDate(), this.peopleAngles.get(d.person)); })
      .attr('y1', (d: any, i: number) => { return this.getYCoordinates(d.startDate.toDate(), this.peopleAngles.get(d.person)); })
      .attr('y2', (d: any, i: number) => { return this.getYCoordinates(d.endDate.toDate(), this.peopleAngles.get(d.person)); });

    let categories = new Set<string>();
    let categoricalArc = d3.arc();
    categoricalArc
      .innerRadius(() => { return this.rScale.range()[1] + 5; })
      .outerRadius(() => { return this.rScale.range()[1] + 20; })
      .startAngle((d: any) => {
        return (this.peopleAngles.get(d.key) + Math.PI / 2) - this.theta / 2;
      })
      .endAngle((d: any) => { return (this.peopleAngles.get(d.key) + Math.PI / 2) + this.theta / 2; });

    console.log(dataByPerson);
    let categoricalBars = this.radialG.selectAll('.category').data(dataByPerson);
    categoricalBars
      .enter()
      .append('path')
      .attr('class', 'category')
      .attr('d', categoricalArc)
      .on('mouseover', (d: any) => {
        if (d.hidden) return;
        let person = this.people.find((p: PersonOrganization & Location) => { return p.name === d.key; })
        let artistName = '';
        person.names.forEach((name: any) => {
          if (name.nameType === 'Showbiz Name') artistName = name.name;
        });
        this.tooltip.nativeElement.style.display = 'block';
        this.tooltip.nativeElement.style.top = `${d3.event.pageY}px`;
        this.tooltip.nativeElement.style.left = `${d3.event.pageX + 20}px`;
        this.tooltip.nativeElement.innerHTML = `
        <h3>${artistName !== '' ? artistName : person.name}</h3>
        ${artistName !== '' ? `<span class="aka">a.k.a. ${d.key}</span>` : ''}
        <p>Category ${(person as any).category}</p>
        `;
      })
      .on('mouseout', () => {
        this.tooltip.nativeElement.style.display = 'none';
      })
      .on('click', (d: any) => {
        this.displayPersonDetails(d.key);
      })
      .merge(categoricalBars)
      .transition().duration(250)
      .attr('d', categoricalArc)
      .attr('stroke', '#7b7b7b')
      .attr('fill', (d: any) => {
        let person = this.people.find((p: any) => { return p.name === d.key; });
        console.log(person);
        categories.add((person as any).category);
        console.log(categories);
        return this.categoricalColors((person as any).category);
      });


    let peopleNames = this.radialG.selectAll('.person-name').data(dataByPerson);

    peopleNames.
      enter()
      .append('text')
      .attr('class', 'person-name')
      .merge(peopleNames)
      .transition().duration(250)
      .text((d: any) => {
        let person = this.people.find((p: any) => { return p.name === d.key; });
        let artistName = '';
        person.names.forEach((name: any) => {
          if (name.nameType === 'Showbiz Name') artistName = name.name;
        })
        return artistName !== '' ? artistName : d.key;
      })
      .attr('opacity', () => { return this.showNames ? 1 : 0; })
      .style('font-size', '11px')
      .attr('transform', (d: any, i: number) => {
        let rotate = (this.theta * i * 180 / Math.PI);
        let today = moment();
        let radius = this.rScale(today.add(25, 'years').toDate()); // 8 year offset for text from outer circle
        // TODO: consider using a number as an offset instead of years (years are variable we need a fixed offset)
        let flip = (rotate > 90 && rotate < 270) ? 180 : 0;
        let offset = (rotate > 90 && rotate < 270) ? -1 : .5; // correct offset
        return `rotate(${rotate + offset}) translate(${radius}) rotate(${flip})`;
      })
      .style('text-anchor', (d: any, i: number) => {
        let rotate = (this.theta * i * 180 / Math.PI);
        return (rotate > 90 && rotate < 270) ? 'end' : 'start';
      })
      .attr('color', '#d7d7d7');


    // Legend
    let legendDots = this.legendSVG.selectAll('.dots').data([...categories].sort());
    legendDots.enter()
      .append('rect')
      .attr('class', 'dots')
      // .transition()
      // .duration(250)
      .merge(legendDots)
      .attr('x', -700)
      .attr('y', (d: any, i: any) => {
        return i * 25;
      })
      .attr('width', 14)
      .attr('height', 14)
      // .attr('r', 7)
      .attr('fill', (d: any) => { return this.categoricalColors(d); });

    let peopleByCategory = d3.nest()
      .key((d: any) => {
        let person = this.people.find((p: PersonOrganization & Location) => {
          return p.name === d.person;
        })
        return this.getCategory(person, this.currentGrouping);
      })
      .entries(data);

    let legendLabels = this.legendSVG.selectAll('.labels').data([...categories].sort());
    legendLabels.enter()
      .append('text')
      .attr('class', 'labels')
      // .transition()
      // .duration(250) 
      .merge(legendLabels)
      .attr('x', -670)
      .attr('y', (d: any, i: any) => {
        return 8 + i * 25;
      })
      .attr('fill', (d: any) => { return this.categoricalColors(d); })
      .text((d: any) => {
        let total = dataByPerson.length;
        let people = new Set<string>();
        peopleByCategory.forEach((pbc: any) => {
          if (pbc.key === d) {
            pbc.values.forEach((v: any) => {
              people.add(v.person);
            })
          }
        });

        let ofType = people.size;
        let percent = Math.ceil(ofType / total * 100);
        return `${d} (${percent}%)`;
      })
      .attr('text-anchor', 'left')
      .attr('alignment-baseline', 'middle');

    legendDots.exit().remove();
    legendLabels.exit().remove();

    gridLines.exit()
      .transition().duration(250)
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', 0)
      .attr('y2', 0)
      .attr('stroke', (d: any) => { return '#ffffff'; })//this.colors(d.key); })
      .remove();

    beforeDeathLines.exit()
      .transition().duration(250)
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', 0)
      .attr('y2', 0)
      .attr('stroke', (d: any) => { return '#ffffff'; })//this.colors(d.key); })
      .remove();

    categoricalBars.exit()
      .transition().duration(250)
      .attr('fill', '#000')
      .remove();

    peopleNames.exit()
      .transition().duration(250)
      .remove();

    eventLines.exit()
      .transition().duration(250)
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', 0)
      .attr('y2', 0)
      .attr('stroke', (d: any) => { return '#ffffff'; })//this.colors(d.key); })
      .remove();

    // brush above things
    d3.select('.radial-brush').raise();
  }

  handleMouseout(): void {
    // TODO: improve - after selecting a time period and mouseovering a 
    // event in the timeline - the rddial visualization is desync'd
    if (this.showingList) {
      let start = this.currentlySelectedMinDate;
      let end = this.currentlySelectedMaxDate;
      let peopleNamesInRange = new Set<string>();
      // also highlight the people in the vis
      this.radialG.selectAll('.event') // after death / event line
        .transition()
        .duration(250)
        .attr('stroke', (d: any) => {
          if (d.startDate.isBetween(start, end, 'year')) {
            peopleNamesInRange.add(d.person);
          }
          return d.startDate.isBetween(start, end, 'year') ? this.colors(d.color) : '#777777';
        })
        .attr('opacity', (d: any) => {
          return d.startDate.isBetween(start, end, 'year') ? 1 : .25;
        });

      this.radialG.selectAll('.person-name')
        .attr('opacity', (d: any) => {
          if (!this.showNames) return 0;
          return peopleNamesInRange.has(d.key) ? 1 : 0;
        });

      this.radialG.selectAll('.category')
        .attr('opacity', (d: any) => {
          return peopleNamesInRange.has(d.key) ? 1 : 0;
        });

      this.radialG.selectAll('.before-death')
        .transition()
        .duration(250)
        .attr('stroke', (d: any) => {
          // find bday
          let bday = d.values.filter((dd: any) => { return dd.dateName === 'Birth'; })[0];
          if (bday && bday.startDate) {
            return bday.startDate.isBetween(start, end, 'year') ? '#A5F0D6' : '#777777';
          } else {
            return '#A5F0D6';
          }
        })
        .attr('opacity', (d: any) => {
          // find bday
          let bday = d.values.filter((dd: any) => { return dd.dateName === 'Birth'; })[0];
          if (bday && bday.startDate) {
            return bday.startDate.isBetween(start, end, 'year') ? 1 : .25;
          } else {
            return 1;
          }
        });

      this.chartG.selectAll('.dots')
        .transition()
        .duration(250)
        .attr('fill', (d: any) => {
          return d.startDate.isBetween(start, end, 'year') ? this.colors(d.color) : '#777777';
        }).attr('opacity', (d: any) => {
          return d.startDate.isBetween(start, end, 'year') ? 1 : .25;
        });
    }
    if (!this.showingList) {
      this.radialG.selectAll('.person-name')
        .transition().duration(250)
        .attr('opacity', (d: any) => {
          if (!this.showNames) return 0;
          return d.hidden ? 0 : 1
        });

      this.radialG.selectAll('.before-death')
        .transition().duration(250)
        .attr('stroke', '#A5F0D6')
        .attr('opacity', (d: any) => { return d.hidden ? 0.25 : 1 });

      this.radialG.selectAll('.category')
        .transition().duration(250)
        .attr('opacity', (d: any) => {
          return d.hidden ? 0 : 1
        });

      this.radialG.selectAll('.event')
        .transition().duration(250)
        .attr('stroke-width', '8px')
        .attr('stroke', (d: any) => { return this.colors(d.color); });

      this.chartG.selectAll('.dots')
        .transition().duration(250)
        .attr('r', 4)
        .attr('fill', (d: any) => { return this.colors(d.color); })
        .attr('opacity', (d: any) => { return d.hidden ? 0.25 : 1 });
    }
  }

  handleMouseover(dateName: string, dateID: string, personID: string, personName: string, rad: boolean): void {
    if (this.radialG && !rad) {
      this.radialG.selectAll('.person-name')
        .attr('opacity', (d: any) => {
          if (!this.showNames) return 0;
          return personName.localeCompare(d.key) ? 0 : 1;
        });

      this.radialG.selectAll('.before-death')
        .attr('stroke', (d: any) => {
          return d.key === personName ? '#A5F0D6' : '#e7e7e7';
        })
        .attr('opacity', (d: any) => {
          return d.key === personName ? 1 : .25;
        });

      this.radialG.selectAll('.category')
        .attr('opacity', (d: any) => {
          return d.key === personName ? 1 : 0;
        })

      this.radialG.selectAll('.event')
        // .transition().duration(250)
        .attr('stroke-width', (d: any) => {
          return d.dateName === dateName && d.personID === personID ? '10px' : '8px';
        })
        .attr('stroke', (d: any) => {
          return d.dateName === dateName && d.personID === personID ? this.colors(d.color) : '#e7e7e7';
        });
      this.radialG.select(`.event[data-dateid="${dateID}"]`).raise(); // raise selection
    }

    if (this.chartG && rad) {
      this.chartG.selectAll('.dots')
        // .transition().duration(250)
        .attr('r', (d: any) => {
          return d.dateName === dateName && d.personID === personID ? 8 : 4;
        })
        .attr('fill', (d: any) => {
          return d.dateName === dateName && d.personID === personID ? this.colors(d.color) : '#e7e7e7';
        })
        .attr('opacity', (d: any) => {
          return d.dateName === dateName && d.personID === personID ? 1 : .25;
        });
    }
  }

  /**
   * Renders a timeline chart of event types (count) over time
   * @param data the dataset 
   */
  renderChart(data: Array<any>): void {
    let radius = 4;
    let timelineHeight = 200;
    //'street', 'exhibition', 'exile', 'prize', 'none'

    // sort by year and then by color (event type)
    let filteredData = new Array<any>();

    d3.nest<any, any>()
      .key((d: any) => { return moment(d.startDate).year().toString(); })
      .sortKeys(d3.ascending)
      .sortValues((a: any, b: any) => { return a.color.localeCompare(b.color); })
      .entries(data)
      .forEach((d: any) => {
        d.values.forEach((v: any) => {
          if (v.color !== 'none') filteredData.push(v);
        });
      });


    this.countByYear = d3.nest<any, any>()
      .key((d: any) => {
        return moment(d.startDate).year().toString();
      })
      .sortKeys(d3.ascending)
      .rollup((s: any) => {
        return {
          street: s.filter((ss: any) => { return ss.color === 'street' }).length,
          exhibition: s.filter((ss: any) => { return ss.color === 'exhibition' }).length,
          prize: s.filter((ss: any) => { return ss.color === 'prize' }).length,
          exile: s.filter((ss: any) => { return ss.color === 'exile' }).length,
          anniversary: s.filter((ss: any) => { return ss.color === 'anniversary' }).length,
          conference: s.filter((ss: any) => { return ss.color === 'conference' }).length,
          memorial: s.filter((ss: any) => { return ss.color === 'memorial' }).length,
          none: s.filter((ss: any) => { return ss.color === 'none' }).length,
        };
      })
      .entries(filteredData)
    
    console.log(filteredData);

    // 2 * radius margin left and right on X
    this.xChartScale = d3.scaleTime().range([radius * 2, (this.timelineChart.nativeElement.clientWidth - radius * 2)]).domain([moment('01-01-1930', 'DD-MM-YYYY'), this.MAX_DATE]);
    this.yChartScale = d3.scaleLinear().range([this.timelineChart.nativeElement.clientHeight, 0]).domain([0, 20]).nice();
    // special year
    let tickAmount = this.MAX_DATE.diff(this.MIN_DATE, 'years') / 10;
    let ticks = this.xChartScale.ticks(Math.floor(tickAmount));
    ticks.push(moment('01-01-1945').toDate());

    let xAxis = d3.axisBottom(this.xChartScale)
      // .ticks(d3.timeYear.every(10))
      .tickSize(200)
      .tickFormat((d: Date) => {
        return d3.timeFormat('%Y')(d);
      })
      .tickValues(ticks);

    this.chartG = this.timeChartSVG
      .append('g')
      .attr('width', 1920)
      .attr('height', timelineHeight)
      .call(xAxis);

    // set data attribute so we can select via css
    this.chartG.selectAll('.tick').attr('data-year', (d: any) => { return moment(d).year(); });
    // style axis ticks
    this.chartG.selectAll('.tick line').attr('stroke', '#e3e3e3').attr('stroke-width', '1px'); //.attr('stroke-dasharray', '2,2');
    // special stroke for special year
    this.chartG.select('.tick[data-year="1945"] > line').attr('stroke-width', '3px').attr('stroke', '#828282').attr('stroke-dasharray', '0,0');
    // position text
    this.chartG.selectAll('.tick text').attr('y', 10).attr('dy', 0);

    this.chartG.select('.domain').remove(); // black line ontop of timeline

    // brush
    this.chartBrush = d3.brushX()
      .extent([[0, 0], [this.xChartScale.range()[1], 200]]) // 0,0 - width, height
      .on('end', this.brushing.bind(this));

    this.chartG.append('g')
      .attr('class', 'brush')
      .call(this.chartBrush);

    let dots = this.chartG.selectAll('.dots').data(filteredData);
    let currentYear = 0;
    let offset = 0;

    // Sort the items based on their categorical attribute and in time
    dots.enter()
      .append('circle')
      .attr('class', (d: any) => {
        // if(d.color === 'none') console.log(d); // TODO: should probably discuss which events are to be shown and how we can categorize them
        return `dots ${d.color}`;
      })
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('r', radius)
      .attr('fill', '#000')
      .on('mouseover', (d: any, i: number, n: any) => {
        // if (d.hidden) return;
        // if filter selected and object not of filter type - no interaction
        if (this.beingFiltered && this.currentFilter !== d.color) return;

        this.tooltip.nativeElement.style.display = 'block';
        this.tooltip.nativeElement.style.top = `${d3.event.pageY}px`;
        this.tooltip.nativeElement.style.left = `${d3.event.pageX + 20}px`;
        // clamp tt to bottom - dont render outside of view
        let top = this.tooltip.nativeElement.offsetTop;
        let tooltipBBox = (d3.select('#tooltip').node() as any).getBoundingClientRect();
        if (top + tooltipBBox.height > this.window.innerHeight) {
          top -= tooltipBBox.height;
          this.tooltip.nativeElement.style.top = `${top}px`;
        }
        // clamp it to right
        let left = this.tooltip.nativeElement.offsetLeft;
        if (left + tooltipBBox.width > this.window.innerWidth) {
          left -= tooltipBBox.width;
          this.tooltip.nativeElement.style.left = `${left}px`;
        }
        let person = this.people.find((p: PersonOrganization & Location) => { return p.name === d.person; });
        let artistName = '';
        person.names.forEach((name: any) => {
          if (name.nameType === 'Showbiz Name') artistName = name.name;
        });
        this.tooltip.nativeElement.innerHTML = `
        <h3>${artistName !== '' ? artistName : d.person} - ${d.dateName}</h3>
        <p>${moment(d.startDate).format('DD/MM/YYYY')} - ${moment(d.endDate).format('DD/MM/YYYY')}</p>
        <p>Category ${d.color}</p>
        `;
        this.handleMouseover(d.dateName, d.dateID, d.personID, d.person, false);
      })
      .on('mouseout', (d: any, i: number, n: any) => {
        this.tooltip.nativeElement.style.display = 'none';
        this.handleMouseout();
      })
      .merge(dots)
      .transition().duration(250)
      .attr('cx', (d: any, i: number) => {
        return this.xChartScale(moment(`01/01/${d.startDate.year()}`, 'DD/MM/YYYY').toDate());
      })
      .attr('cy', (d: any, i: number) => {
        if (!currentYear) currentYear = d.startDate.year();

        // reset idx if current year changes
        if (currentYear !== d.startDate.year()) {
          offset = 0;
          currentYear = d.startDate.year();
        }
        let yPos = timelineHeight - (offset * 2 * radius + radius); // height - yPos (offset + rad/2)
        offset++;
        return yPos;
      })
      .attr('fill', (d: any) => {
        return this.getColorForType(d.color);
      });

    dots.exit()
      .transition().duration(250)
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('fill', '#000')
      .remove();

    d3.select('.selection').attr('fill', '#4286f4').attr('fill-opacity', .15).attr('stroke', '#fff').attr('stroke-opacity', 1);
  }

  /**
   * Updates the D3 scales to map the full vis space to the new temporal range 
   * "Temporal zooming"
   * @param from starting point of the temporal selection (Date object)
   * @param to end point of the temporal selection (Date object)
   */
  updateScales(from?: Date, to?: Date): void {
    // return; 
    // // TODO: Doesn't work as intended
    if (!from) from = this.currentlySelectedMinDate;
    if (!to) to = this.currentlySelectedMaxDate;

    this.xScale = d3.scaleTime()
      .domain([moment(from), moment(to)])
      .range([0, (this.WIDTH - (this.margin.left + this.margin.right))]);
    // .range([0, (this.WIDTH - (this.margin.left + this.margin.right))]);

    // rScale range starts from 50 to create an empty hole at the center
    this.rScale = d3.scaleTime()
      .domain([moment(from), moment(to)])
      .range([50, Math.min((this.WIDTH - (this.margin.left + this.margin.right) / 2), (this.HEIGHT - (this.margin.top + this.margin.bottom)) / 2)])

    this.xChartScale = d3.scaleTime().domain([moment(from), moment(to)]);
    let newData = this.data.filter((d: any) => {
      return moment(d.startDate).isBetween(from, to, 'year');
    });
    this.renderRadial(newData);
    this.renderChart(newData);
  }

  /**
   * Programatically set the timeline chart brush extent
   * @param startDate start date (mapped to x coords)
   * @param endDate end date (mapped to x coords)
   */
  setChartBrush(startDate: Date, endDate: Date): void {
    if (!startDate) return;

    let startX = this.xChartScale(startDate);
    let endX = this.xChartScale(endDate);

    d3.select('.brush').call(this.chartBrush.move, [startX, endX]);
  }

  chartBrushing(): void {
    if (!d3.event.selection) return;
    let start = d3.event.selection[0];
    let end = d3.event.selection[1];

    let startDate = this.xChartScale.invert(start);
    let endDate = this.xChartScale.invert(end);


    this.drawDonut(this.rScale(startDate), this.rScale(endDate));
  }

  /**
   * Event handler for the timeline brush
   * Triggered when a selection has been made
   */
  brushing(): void {
    if (!d3.event.selection) return;
    let start = d3.event.selection[0];
    let end = d3.event.selection[1];

    let startDate = this.xChartScale.invert(start);
    let endDate = this.xChartScale.invert(end);
    // update date selection
    this.currentlySelectedMinDate = startDate;
    this.currentlySelectedMaxDate = endDate;

    let exhibitionCount = 0;
    let streetCount = 0;
    let prizeCount = 0;
    let memorialCount = 0;
    let anniversaryCount = 0;
    let conferenceCount = 0;
    this.countByYear.forEach((c: any) => {
      if (moment(c.key).isBetween(this.currentlySelectedMinDate, this.currentlySelectedMaxDate, 'year')) {
        exhibitionCount += c.value['exhibition'];
        streetCount += c.value['street'];
        prizeCount += c.value['prize'];
        memorialCount += c.value['memorial'];
        anniversaryCount += c.value['anniversary'];
        conferenceCount += c.value['conference'];
      }
    });
    // TODO: Provide additional stats about the selection
    // i.e., exiled vs non-exiled distribution

    // update radial selection
    let width = end - start;
    let tooltipBBox = (d3.select('#count-tooltip').node() as any).getBoundingClientRect();

    let leftPos = start + width / 2 - tooltipBBox.width / 2;
    leftPos = leftPos < 0 ? 5 : leftPos; // check left
    leftPos = leftPos > this.timelineChart.nativeElement.clientWidth ? this.timelineChart.nativeElement.clientWidth - width : leftPos; // check right
    d3.select('#count-tooltip')
      .style('left', `${leftPos}px`)
      .style('bottom', `calc(${this.timelineChart.nativeElement.clientHeight}px + 5px)`) // 20px from tl
      .style('opacity', 1)
      .html(
        `<h4>Count for ${this.displayDate(this.currentlySelectedMinDate)} - ${this.displayDate(this.currentlySelectedMaxDate)}</h4>
              <p style="color: ${this.colors('exhibition')}">Exhibitions ${exhibitionCount}</p>
              <p style="color: ${this.colors('street')}">Street-namings ${streetCount}</p>
              <p style="color: ${this.colors('prize')}">Prizes ${prizeCount}</p>
              <p style="color: ${this.colors('memorial')}">Memorials ${memorialCount}</p>
              <p style="color: ${this.colors('anniversary')}">Anniversaries ${anniversaryCount}</p>
              <p style="color: ${this.colors('conference')}">Conferences ${conferenceCount}</p>
              `
      );

    this.drawDonut(this.rScale(startDate), this.rScale(endDate));
  }


  /**
   * Return human readable date format
   * @param date date object
   */
  displayDate(date: Date): string {
    if (!date) return;
    return moment(date).format('MMMM Do YYYY');
  }

  /**
   * Calculate the duration of a date interval (in years)
   * @param from start date
   * @param to end date
   */
  getDuration(from: Date, to: Date): string {
    return Math.abs(moment(from).diff(moment(to), 'years')).toString();
  }
}
