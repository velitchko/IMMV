import { Component, OnInit, ViewChild, Inject, ElementRef, EventEmitter } from '@angular/core';
import { DatabaseService } from '../../services/db.service';
import { PersonOrganization } from '../../models/person.organization';
import { Location, Geodata } from '../../models/location';
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
import { HistoricEvent } from 'src/app/models/historic.event';

// Endpoint for current vis
const _VIS: string = 'biographical';

// Opacity Values
const OPACITY = {
  full: 1,
  base: 0.65,
  fade: 0.15,
  hide: 0
}

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
  MAX_REL_CNT: number;                      // max relationship count for sizing
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
  nodeSizeScale: d3.ScaleLinear<number, number>; // node size scale
  angleScale: d3.ScaleLinear<number, number>;
  rScale: d3.ScaleTime<number, number>;
  colors: d3.ScaleOrdinal<string, {}>;  // d3 color coding
  colorGreys: d3.ScaleOrdinal<string, {}>;
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
  zoom: any;

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
  objects: Array<Event & PersonOrganization & Location>;         // people/organizations array
  historicEvents: Array<string>;
  locations: Array<string>;
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
  flipTime: boolean;

  eventTypes: Array<string>;
  nodeSizes: Array<string>;

  ordering: Array<string>;
  currentOrder: string;

  grouping: Array<string>;
  currentGrouping: string;

  objectSelected: boolean;
  detailPanelOpen: boolean;
  selectedObject: Event | PersonOrganization | Location; // one of the following types

  // Autocomplete
  objectCtrl: FormControl;
  // histFilterCtrl: FormControl;
  filteredObjects: Observable<Array<PersonOrganization & Location>>;
  // filteredHistEvents: Observable<Array<HistoricEvent>>

  beingFiltered: boolean;
  currentFilter: string;
  currentNodeSizing: string;

  preset: string;
  dataType: string;
  themeID: string;
  /**
   * @param db DatabaseService - the service we use to perform database queries and get requests
   * @param window (JS) Window object - Leaflet needs this and we provide it (check app.module.ts)
   * @param route the route object containing information about the URL parameters 
   * @param _platformId Object determining if we are on the server or browser side
   */
  constructor(private db: DatabaseService, @Inject('WINDOW') private window: any, @Inject(PLATFORM_ID) private _platformId: Object, private route: ActivatedRoute) {
    this.preset = this.route.snapshot.paramMap.get('preset');
    this.dataType = this.route.snapshot.queryParamMap.get('dataType');
    this.themeID = this.route.snapshot.queryParamMap.get('themeID');

    this.objectSelected = false;
    this.flipTime = false;
    this.showNames = false;
    this.showingList = false;
    this.mouseBehavior = true;
    this.brushBehavior = true;
    this.beingFiltered = false;
    this.showExiled = false;
    this.currentFilter = '';
    this.detailPanelOpen = false;

    this.currentNodeSizing = 'peopleOrganizations';

    this.objectCtrl = new FormControl();
    // this.histFilterCtrl = new FormControl();
    // this.filteredHistEvents = this.histFilterCtrl.valueChanges
    //   .pipe(
    //     startWith(''),
    //     map((histEv: string) => { return histEv ? this.filterHistEvents(histEv) : this.historicEvents.slice(); })
    //   );
    this.filteredObjects = this.objectCtrl.valueChanges
      .pipe(
        startWith(''),
        map((person: string) => { return person ? this.filterPeople(person) : this.objects.slice().sort((a, b) => { return a.name.localeCompare(b.name); }); })
      );

    this.objects = new Array<Event & PersonOrganization & Location>();
    this.historicEvents = new Array<string>('5bc8887bb9817e01d81db006', '5bc8887bb9817e01d81daff6', '5bc8887bb9817e01d81dafe9', '5bc8887bb9817e01d81dafdc', '5bc8887bb9817e01d81dafda');
    // 35 key locations
    this.locations = new Array<string>('5bc878254a37780173b531d2', '5bc878254a37780173b531dd', '5bc878254a37780173b531e0', '5bc878254a37780173b531e8',
      '5bc878254a37780173b531f2', '5bc878254a37780173b5320f', '5bc878254a37780173b53213', '5bc878254a37780173b53219',
      '5bc878254a37780173b5323f', '5bc878254a37780173b53242', '5bc878254a37780173b53248', '5bc878254a37780173b53273',
      '5bc878254a37780173b5328c', '5bc878254a37780173b5329a', '5bc878254a37780173b532a4', '5bc878254a37780173b532c8',
      '5bc878254a37780173b532ea', '5bc878254a37780173b532f5', '5bc878254a37780173b5330d', '5bd9d52f2447d22473b2d639',
      '5be9543b2447d22473b2ea49', '5be959222447d22473b2ea73', '5be95e4e2447d22473b2ea8e', '5be967402447d22473b2eb02',
      '5c3323235c9d43155c96499a', '5c33254b5c9d43155c9649b9', '5c33557f5c9d43155c964e61', '5c3dc0cb3fe57001f2a01feb',
      '5c51da721bb7f85d3b1e5b20', '5cf6aa0596dea228181335d9', '5cf7d54096dea22818133bcb', '5d4c3b1cb08c896317dc3373',
      '5d824f58c9cc8f5cf77fc9d8', '5d822be7f884422184a17f70', '5bc878254a37780173b5321c');
    this.data = new Array<any>();
    this.nodeSizes = new Array<string>('events', 'historicEvents', 'peopleOrganizations', 'locations', 'themes', 'sources');

    this.theta = 0;

    this.colorGreys = d3.scaleOrdinal().range(d3.schemeGreys[9]);//(d3.schemeSet2);
    // .domain(['Musician', 'Composer', 'Conductor', 'Author', 'Mixed'])
    // .range(['#F286D2', '#36b3d0', '#FFE18D', '#ff0000', '#efefef']);



    this.peopleAngles = new Map<string, number>();

    this.currentlySelectedEvents = new Array<any>();
    this.currentlySelectedPeople = new Array<any>();

    this.db.getAllThemes(); // preload all themes
    this.db.getAllEvents(); // preload all events
    this.db.getAllPeopleOrganizations(); // preload all people / organizations
    this.db.getAllLocations(); // preload all locations
    this.db.getAllSources(); // preload all sources

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
      // define map & setup map
      this.orderingMap = new Map<string, Map<string, any>>();
      this.setupMaps();
      // get data based on data type (passed from URL ?dataType=<data-type> queryParam)
      switch (this.dataType) {
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

      this.db.getAllHistoricEvents().then((success) => {
        // this.historicEvents = success;
      });
    }
  }

  /**
   * Sets up the maps that are used for the ordering and grouping criteria
   */
  setupMaps(): void {
    // meta map
    switch (this.dataType) {
      case 'events':
        break;
      case 'people':
        // create maps for orderings
        this.orderingMap.set('First Post-death Event', new Map<string, moment.Moment>());
        this.orderingMap.set('Birth', new Map<string, moment.Moment>());
        this.orderingMap.set('Death', new Map<string, moment.Moment>());
        this.orderingMap.set('Honoring Time', new Map<string, moment.Moment>());

        this.ordering = Array.from(this.orderingMap.keys());
        this.currentOrder = 'Birth';

        this.grouping = new Array<string>('None', 'Role', 'Exiled', 'Born after 1945', 'Died before 1938', 'Gender');
        this.currentGrouping = 'None';
        break;
      case 'locations':
        this.orderingMap = new Map<string, Map<string, any>>();
        // create maps for orderings
        this.orderingMap.set('Number of Events', new Map<string, moment.Moment>());
        this.orderingMap.set('Proximity to Center', new Map<string, moment.Moment>());
        this.orderingMap.set('First Event', new Map<string, moment.Moment>());

        this.ordering = Array.from(this.orderingMap.keys());
        this.currentOrder = 'First Event';

        this.grouping = new Array<string>('District', 'Location Type');
        this.currentGrouping = 'None';
        break;
      case 'sources':
        break;
      case 'themes':
        break;
      case 'historicevents':
        break;
      default:
        // create maps for orderings
        this.orderingMap.set('First Post-death Event', new Map<string, moment.Moment>());
        this.orderingMap.set('Birth', new Map<string, moment.Moment>());
        this.orderingMap.set('Death', new Map<string, moment.Moment>());
        this.orderingMap.set('Honoring Time', new Map<string, moment.Moment>());

        this.ordering = Array.from(this.orderingMap.keys());
        this.currentOrder = 'Birth';

        this.grouping = new Array<string>('None', 'Role', 'Exiled', 'Born after 1945', 'Died before 1938', 'Gender');
        this.currentGrouping = 'None';
        break;
    }
  }

  /**
   * Clears the input in the autocomplete field
   */
  clearAutoComplete(): void {
    this.objectCtrl.setValue('');
  }
  /**
   * Clears the input in the chrono autocomplete field
   */
  // clearChronoAutoComplete(): void {
  //   this.histFilterCtrl.setValue('');
  //   this.clearTimeSelection();
  // }

  /**
   * Returns color for the event type / categorical value
   * @param type event type or categorical value
   * @return d3.scaleOrdinal object resolving the color
   */
  getColorForType(type: string): {} {
    return this.colors(type);
  }

  /**
   * Returns color for the corresponding main theme or gray if its not a main theme
   * @param id - id of the theme
   * @return d3.scaleOrdinal object resolving the color
   */
  getColorForTheme(id: string): {} {
    let theme = this.db.getThemeById(id);
    if (theme.themeTypes.includes('Main Topics')) return this.colors(theme.name);
    return '#e7e7e7';
  }


  /**
   * Filters the data to find a person by name
   * Used for the person autocomplete
   * @param personName the persons name
   */
  filterPeople(personName: string): Array<PersonOrganization & Location> {
    let nameVal = personName.trim().toLowerCase();

    return this.objects.filter((person: PersonOrganization & Location) => {
      return person.name.trim().toLowerCase().includes(nameVal) || person.names.map((n: any) => { return n.name.trim().toLowerCase(); }).includes(nameVal);
    }).sort((a, b) => {
      return a.name.localeCompare(b.name);
    });
  }

  // TODO: Consider trying to search by date-span for corresponding historic events
  /**
   * Filters the data to find a historic event by name
   * Used for the historic event autocomplete
   * @param histEv 
   */
  // filterHistEvents(histEv: string): Array<HistoricEvent> {
  //   let nameVal = histEv.trim().toLowerCase();

  //   return this.historicEvents.filter((historicEvent: HistoricEvent) => {
  //     return historicEvent.name.trim().toLowerCase().includes(nameVal);
  //   })
  // }

  // TODO: Should update vis with new time-span selected by a historic event
  /**
   * Filters the dataset based on a historic event temporal selection
   * @param histEv - historic event that the user has selected as a filter
   */
  chronoFilter(histEv: HistoricEvent): void {
    this.drawDonut(this.rScale(histEv.startDate), this.rScale(histEv.endDate));
    this.setChartBrush(histEv.startDate, histEv.endDate);
  }

  /**
   * Rotates the radial vis to focus on a specific highlight
   * @param closed - boolean indicating if a person is selected or de-selected
   */
  spinTo(closed: boolean = false): void {
    if (closed) {
      // if (!this.mouseBehavior) this.toggleMouseBehavior(); // turn back on if closing
      // rotate back by -Math.PI
      this.detailPanelOpen = false;
      this.timelineSVG
        .transition().duration(250)
        .attr('transform', 'rotate(0)');
      this.unhighlightPerson();
    } else {
      if (this.mouseBehavior) this.toggleMouseBehavior(); // turn off if true
      // rotate to Math.PI
      this.detailPanelOpen = true;
      let currentAngle = this.peopleAngles.get(this.selectedObject.name) * (180 / Math.PI); // to degrees
      this.timelineSVG
        .transition().duration(250)
        .attr('transform', `rotate(${180 - currentAngle})`);

      this.highlightPerson(this.selectedObject.name);
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
    let peopleNames = new Set<string>();

    this.radialG.selectAll('.event')
      .transition()
      .duration(250)
      .attr('stroke-opacity', (d: any, i: any, n: any) => {
        if (type === 'all') return OPACITY.base;
        if (d.color === type) d3.select(n[i]).raise();
        if(d.color === type) peopleNames.add(d.person);
        return (d.color !== type && d.color !== 'other') ? OPACITY.fade : OPACITY.base;
      })
      .attr('stroke', (d: any) => {
        if (type === 'all') {
          return d.dateName === 'Birth' || d.dateName === 'Death' ? '#59a14f' : this.colors(d.color);
        } 
        if (d.color === 'other') return '#e7e7e7';
        return d.color !== type ? '#e7e7e7' : this.colors(d.color);
      });

      this.radialG.selectAll('.category')
        .transition()
        .duration(250)
        .attr('opacity', (d: any) => {
          if(type === 'all') return OPACITY.base;
          return ([...peopleNames].includes(d.key)) ? OPACITY.base : OPACITY.hide;
        });
    
      this.radialG.selectAll('.event')
        .transition()
        .duration(250)
        .attr('stroke-opacity', (d: any) => {
          if(type === 'all') return OPACITY.base;
          if(d.color === type) return; // these are already set
          return ([...peopleNames].includes(d.person) && (d.dateName === 'Death' || d.dateName === 'Birth')) ? OPACITY.base : OPACITY.hide;
        });
  
      this.radialG.selectAll('.before-death')
      .transition()
      .duration(250)
      .attr('stroke-opacity', (d: any) => {
        if(type === 'all') return OPACITY.base;
        return ([...peopleNames].includes(d.key)) ? OPACITY.base : OPACITY.hide;
      });
    
    this.chartG.selectAll('.dots')
      .transition()
      .duration(250)
      .attr('opacity', (d: any) => {
        if (type === 'all') return OPACITY.full;
        //  && d.color !== 'none'
        return (d.color !== type) ? OPACITY.fade : OPACITY.full;
      })
      .attr('fill', (d: any) => {
        if (type === 'all') return this.colors(d.color);
        if (d.color === 'none') return '#e7e7e7';
        return d.color !== type ? '#e7e7e7' : this.colors(d.color);
      });
  }

  /**
   * Does some string comparison to determine the type of event 
   * @param eventName name of the event
   */
  getEventType(eventName: string): string {
    // TODO: Event types for Locations?
    let name = eventName.trim().toLowerCase();
    let cat = 'other';
    if (name.includes('gedenk') || name.includes('denkmal') || name.includes('nachlass') || name.includes('büste')) cat = 'memorial';
    if (name.includes('benannt') || name.includes('benennung')) cat = 'street';
    if (name.includes('verleihung') || name.includes('verliehen') || name.includes('preis') || name.includes('bürger') || name.includes('ehrenmedaille')) cat = 'prize';
    if (name.includes('symposium') || name.includes('konferenz')) cat = 'conference';
    if (name.includes('todestag') || name.includes('geburtstag')) cat = 'anniversary';
    if (name.includes('ausstellung')) cat = 'exhibition';
    if (name.includes('exil')) cat = 'exile';

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
      dataPoint.objectType = event.objectType;
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
   * @param personLocation person/organization object
   * @param groupingScheme defines the current grouping
   */
  getCategory(personLocation: (PersonOrganization & Location), groupingScheme: string): string {
    let cat = '';
    if (this.dataType === 'people') {
      if (personLocation.roles) {
        if (groupingScheme === 'Role' || groupingScheme === 'None') { // default
          let fallsIntoCat = 0;

          if (personLocation.roles.includes('Musician') || personLocation.roles.includes('Performer') || personLocation.roles.includes('Vocalist')) {
            cat = 'Musician';
            fallsIntoCat++;
          }
          if (personLocation.roles.includes('Author')) {
            cat = 'Author';
            fallsIntoCat++;
          }
          if (personLocation.roles.includes('Composer')) {
            cat = 'Composer'
            fallsIntoCat++;
          }
          if (personLocation.roles.includes('Conductor')) {
            cat = 'Conductor';
            fallsIntoCat++;
          }
          return cat;
        } else if (groupingScheme === 'Exiled') {
          let cat = personLocation.functions.map((f: any) => { return f.dateName; }).includes('Exil') ? 'Exiled' : 'Not-Exiled';
          return cat;
        } else if (groupingScheme === 'Born after 1945') {
          let bday: moment.Moment;

          for (let i = 0; i < personLocation.dates.length; i++) {
            let date = personLocation.dates[i];

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

          for (let i = 0; i < personLocation.dates.length; i++) {
            let date = personLocation.dates[i];

            if (date.dateName === 'Death') {
              dday = moment(date.date);
              return dday.isSameOrBefore('1938', 'year') ? 'Died before 1938' : 'Died after 1938';
            }
          }
          if (!dday) {
            return '?';
          }
        } else if (groupingScheme === 'Gender') {
          return personLocation.gender;
        }
      }
    }

    if (this.dataType === 'locations') {
      if (groupingScheme === 'Location Type') {
        if (personLocation.locationTypes) {
          return personLocation.locationTypes[0]  ? personLocation.locationTypes[0] : 'Other';
        }
      } else if (groupingScheme === 'District') {
        let district = '';
        personLocation.geodata.forEach((g: Geodata) => {
          district = `${g.districtNumber}`; // num to string
        });
        return district; // !== '' ? district : '?';
      }
      return 'Other';
    }
    // return this.categoricalArray[Math.floor(Math.random() * 3)];
  }

  /**
   * Filters the events and people to only show those that are exiled
   * then orders them according to the current ordering strategy
   * calls render to update changes
   */
  showKeyLocations(): void {
    // TODO: Implement like the show exile but for key locations
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

    this.objects.forEach((person: PersonOrganization & Location) => {
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
    this.objects.forEach((p: PersonOrganization & Location) => {
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

  /**
   * Returns the distance between two points defined by their lat/lng coordinates
   * Distance from location to center of Vienna (Stephansplatz)
   * Adapted from: https://www.geodatasource.com/developers/javascript
   * @param location the location we are checking the distance of to Stephansplatz
   * @param unit the unit of distance K - Kilometers, M - Miles, N - Nautical Miles
   */
  getDistance(location: Location, unit: string = 'K'): number {
    // TODO: Check if lat/lng or geodata exist on location object
    // TODO: Do we always take the first geodata object from the array?
    if (!location.geodata || location.geodata.length === 0) return 0;
    let geodata = location.geodata[0];
    let lat1 = geodata.lat;
    let lng1 = geodata.lng;

    if (!lat1 || !lng1) return 0; // no lat / lng TODO: Look for other array elements or?

    //NOTE: Stephansplatz (Considered center)
    let lat2 = 48.208561;
    let lng2 = 16.373124;
    if ((lat1 == lat2) && (lng1 == lng2)) {
      return 0;
    }
    else {
      let radlat1 = Math.PI * lat1 / 180;
      let radlat2 = Math.PI * lat2 / 180;
      let theta = lng1 - lng2;
      let radtheta = Math.PI * theta / 180;
      let dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
      if (dist > 1) {
        dist = 1;
      }
      dist = Math.acos(dist);
      dist = dist * 180 / Math.PI;
      dist = dist * 60 * 1.1515;
      if (unit === 'K') { dist = dist * 1.609344 }
      if (unit === 'N') { dist = dist * 0.8684 }
      console.log(location.geodata);
      console.log('Distance to ' + location.name + ' : ' + dist);
      console.log('----------');
      return dist;
    }
  }

  //TODO: Get locations by theme
  prepareLocationData(): void {
    let mainThemes = new Set<string>();
    this.eventTypes = new Array<string>('all');
    let maxRelationshipCount = 0;
    let themeID = this.themeID ? this.themeID : ''; // else use some default theme?
    // this.db.getLocationsByTheme(themeID)...
    this.db.getEventsByLocations().then((success: Array<{ location: Location, events: Array<Event> }>) => {
      let locations: Array<Event & PersonOrganization & Location> = success.map((s: { location: Event & PersonOrganization & Location, events: Array<Event> }) => { return s.location; });
      this.objects = locations;
      success.forEach((s: { location: Location, events: Array<Event> }, i: number) => {
        // if(i > 30) return;
        // TODO: Filter locations based on the key locations defined
        // Allow a 'show key locations' button like for the exiled in people vis
        (s.location as any).category = s.location.locationTypes[0];// ? s.location.locationTypes[0] : '?'
        this.orderingMap.get('Number of Events').set(s.location.objectId, s.events.length);
        this.orderingMap.get('Proximity to Center').set(s.location.objectId, this.getDistance(s.location));

        let firstEvent = moment(s.events
          .sort((a: Event, b: Event) => {
            if (!a.startDate || !b.startDate) return 0;
            // TODO: Some events have missing startdates
            return a.startDate.valueOf() - b.startDate.valueOf();
          })[0].startDate);

        this.orderingMap.get('First Event').set(s.location.objectId, firstEvent);
        s.events.forEach((e: Event) => {
          // always get max relationship count for size scaling
          maxRelationshipCount = maxRelationshipCount < e.peopleOrganizations.length ? e.peopleOrganizations.length : maxRelationshipCount;

          // add events to this.data as data points
          let dataPoint: any = {};
          if (!e.startDate) return;
          if (this.getEventType(e.name) === 'prize') return;

          let themeColor: string;
          e.themes.forEach((t: any) => {
            let theme = this.db.getThemeById(t.theme);
            if (!theme) {
              return;
            }
            if (theme.themeTypes.includes('Main Topics')) {
              mainThemes.add(theme.name)
              if (!themeColor) themeColor = theme.name;
            }
          });
          dataPoint.objectType = e.objectType;
          dataPoint.startDate = moment(e.startDate);
          dataPoint.endDate = e.endDate ? moment(e.endDate) : moment(e.startDate);
          dataPoint.person = s.location.name;
          dataPoint.dateID = e.objectId;
          dataPoint.personCategory = s.location.locationTypes[0]; // ? s.location.locationTypes[0] : '?';
          dataPoint.dateName = e.name;
          dataPoint.personID = s.location.objectId;
          dataPoint.category = s.location.locationTypes[0]; // ? s.location.locationTypes[0] : 'none'; // TODO: should be event categorical type
          // dataPoint.color = dataPoint.category; // default: none // TODO: should be colorcoded according to the category
          dataPoint.color = themeColor ? themeColor : 'other';
          if (!this.eventTypes.includes(dataPoint.color) && dataPoint.color !== 'other') this.eventTypes.push(dataPoint.color);
          this.data.push(dataPoint);
        });
        this.MAX_REL_CNT = maxRelationshipCount;
        this.eventTypes.sort(); // sort filter alphabetically
      });

      // console.log([...relationshipDistribution].sort());
      this.calculateScales();
      // create timeline
      this.createTimeline();
      // populate timeline(s)
      let sortedMap = [...this.orderingMap.get(this.currentOrder).entries()]
        .sort((a: any, b: any) => {
          return b[1] - a[1];
        }).map((d: any) => { return d[0]; });

      this.data = this.data.sort((a: any, b: any) => {
        return sortedMap.indexOf(a.personID) - sortedMap.indexOf(b.personID);
      });
      document.addEventListener('resize', this.onResize.bind(this));
      let tableauColors = ['#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f', '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'];
      this.colors = d3.scaleOrdinal().domain([...mainThemes]).range(tableauColors); // d3.schemeSet2/1
      if (this.preset) {
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
    let tableauColors = ['#4e79a7', '#f28e2c', '#59a14f', '#e15759', '#76b7b2', '#edc949', '#af7aa1', '#ff9da7']; //, '#9c755f', '#bab0ab'];
    this.colors = d3.scaleOrdinal()
      .domain(['street', 'exhibition', 'exile', 'prize', 'memorial', 'conference', 'anniversary', 'other'])
      .range(tableauColors); // d3.schemeSet2/1
    // .range(['red', 'blue', '#4F8874', 'purple', '#47DBA7', '#ff6bb5', '#ffa500', '#0dff00']); // old none blue - #027cef
    this.eventTypes = new Array<string>('street', 'exhibition', 'exile', 'prize', 'memorial', 'conference', 'anniversary', 'all');

    let maxRelationshipCount = 0;
    let themeID = this.themeID ? this.themeID : '5be942be2447d22473b2e80c'; // festwochen'5d949c5334492200a542f2e3'; // 1. mai '5d94990f34492200a542f2da'// mdt '5be942be2447d22473b2e80c'; 
    this.db.getPeopleByTheme(themeID).then((success) => {
      this.objects = success;
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
                // always get max relationship count for size scaling
                maxRelationshipCount = maxRelationshipCount < event.peopleOrganizations.length ? event.peopleOrganizations.length : maxRelationshipCount;

                event.themes.forEach((theme: any) => {
                  if (theme.theme === themeID) events.add(event);
                });
              });

              this.MAX_REL_CNT = maxRelationshipCount;
              // console.log([...relationshipDistribution].sort());
              return {
                person: person,
                events: Array.from(events)
              };
            })
        );
      });

      Promise.all(themePromiseEventArray).then((peopleEvents: Array<any>) => {
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
              dataPoint.objectType = person.objectType;
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
              dataPoint.objectType = person.objectType;
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
        this.data = this.data.sort((a: any, b: any) => {
          return sortedMap.indexOf(a.personID) - sortedMap.indexOf(b.personID);
        });
        document.addEventListener('resize', this.onResize.bind(this));


        if (this.preset) {
          this.updateConfig();
        } else {
          this.renderRadial(this.data);
          this.renderChart(this.data);
        }
      });
    });
  }

  getEventsAtLocation(id: string): Array<Event> {
    let events = new Array<Event>();

    return events;
  }

  /**
   * Get config from db setup parameters and update the visualization
   */
  updateConfig(): void {
    this.db.getSnapshot(this.preset).then((success: any) => {
      let parameters = JSON.parse(success.parameters);
      this.selectedObject = parameters.selectedPerson;
      this.currentOrder = parameters.currentOrder;
      this.currentGrouping = parameters.currentGrouping;
      this.currentlySelectedMinDate = moment(parameters.currentlySelectedMinDate).toDate();
      this.currentlySelectedMaxDate = moment(parameters.currentlySelectedMaxDate).toDate();
      this.mouseBehavior = parameters.mouseBehavior;
      this.brushBehavior = parameters.brushBehavior;
      this.currentFilter = parameters.filter;
      // this.historicEvents = [];

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
      if (this.selectedObject) this.highlightPerson(this.selectedObject.name)
    });
  }

  /**
   * On-resize handler
   */
  onResize(): void {
    console.log('resized');
    //TODO: implement
  }

  /**
   * Copies the URL of the current state of the vis to the clipboard
   * @param item URL coming from the db callback when saving the current vis config
   */
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
    this.MAX_DATE = moment('31-12-2018', 'DD-MM-YYYY'); // d3.max(this.data.map((d: any) => { return moment(d.endDate, ['YYYY-MM-DD']); })); 

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

  resetTimeScale(): void {
    this.rScale = d3.scaleTime()
      .domain([this.MIN_DATE, this.MAX_DATE])
      .range([50, Math.min((this.WIDTH - (this.margin.left + this.margin.right) / 2), (this.HEIGHT - (this.margin.top + this.margin.bottom)) / 2)]);

    // update the 1945 mark
    this.radialG.select('.worldwartwo')
      .transition().duration(250)
      .attr('r', () => { return Math.abs(this.rScale(moment('1945').toDate())); });

    this.renderRadial(this.data);
  }

  rescaleTime(start: Date | moment.Moment, end: Date | moment.Moment): void {
    this.rScale = d3.scaleTime()
      .domain([start, end])
      .range([50, Math.min((this.WIDTH - (this.margin.left + this.margin.right) / 2), (this.HEIGHT - (this.margin.top + this.margin.bottom)) / 2)]);

    // update the 1945 mark
    this.radialG.select('.worldwartwo')
      .transition().duration(250)
      .attr('r', () => {
        let ww2 = moment('1945');
        if (ww2.isBefore(this.currentlySelectedMinDate) || ww2.isAfter(this.currentlySelectedMaxDate)) return null;
        return Math.abs(this.rScale(ww2.toDate()));
      });

    this.renderRadial(this.data);
  }

  invertTime(): void {
    // rScale range starts from 50 to create an empty hole at the center
    this.flipTime = !this.flipTime;
    let timeArr = this.flipTime ? [this.MAX_DATE, this.MIN_DATE] : [this.MIN_DATE, this.MAX_DATE];
    this.rScale = d3.scaleTime()
      .domain(timeArr)
      .range([50, Math.min((this.WIDTH - (this.margin.left + this.margin.right) / 2), (this.HEIGHT - (this.margin.top + this.margin.bottom)) / 2)]);

    // update the 1945 mark
    this.radialG.select('.worldwartwo')
      .transition().duration(250)
      .attr('r', () => { return Math.abs(this.rScale(moment('1945').toDate())); });

    this.renderRadial(this.data);

  }

  /**
   * Saves the current state of the vis (selected parameters, people, time ranges, grouping/ordering strategies)
   * Copies resulting url to clipboard
   */
  saveConfig(): void {
    let item = {
      selectedPerson: this.selectedObject,
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

  getThemeName(id: string): string {
    return this.db.getThemeById(id).name;
  }

  getPersonOrganizationName(id: string): string {
    let personOrganization = this.db.getPersonById(id);
    if (!personOrganization)
      personOrganization = this.db.getOrganizationById(id);
    return personOrganization ? personOrganization.name : '';
  }

  getLocationName(id: string): string {
    let location = this.db.getLocationById(id);
    if (!location) return;
    return location.name;
  }

  getSourceName(id: string): string {
    return this.db.getSourceById(id).name;
  }

  getEventName(id: string): string {
    return this.db.getEventById(id).name;
  }

  getHistoricEventName(id: string): string {
    return this.db.getHistoricEventById(id).name;
  }

  /**
   * Open up sidepanel to display a persons details, including
   * events / other people related to them
   * @param name the persons name
   */
  displayPersonDetails(name: string): void {
    this.objectSelected = true;
    this.selectedObject = this.objects.find((p: PersonOrganization & Location) => { return p.name === name; });
    this.spinTo(); // notify that we have opened the side panel
  }

  /**
   * Closes the sidepanel
   */
  closePersonDetails(): void {
    this.objectSelected = false;
    this.selectedObject = undefined;
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
    // this.WIDTH = this.WIDTH - (this.margin.left + this.margin.right);
    // this.HEIGHT = this.HEIGHT - (this.margin.top + this.margin.bottom);
    // group for data
    let g = this.timelineSVG.append('g')
      .attr('width', this.WIDTH - (this.margin.left + this.margin.right))
      .attr('height', this.HEIGHT - (this.margin.top + this.margin.bottom))
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
      .attr('opacity', OPACITY.hide)
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
      .attr('class', 'worldwartwo')
      .attr('r', () => { return Math.abs(this.rScale(moment('1945').toDate())); })
      .attr('stroke', '#777777')
      .attr('stroke-width', '4px')
      .attr('fill', 'none');

    this.zoom = d3.zoom()
      .scaleExtent([1, 40])
      .translateExtent([[-500, -500], [this.WIDTH + 500, this.HEIGHT + 500]])
      .on('zoom', this.zoomed.bind(this));

    this.timelineSVG.call(this.zoom);

    // this.timelineSVG.call(
    //   d3.drag()
    //     .on('start', () => { this.radialDragStart(); })
    //     .on('drag', () => { this.radialDragging(); })
    //     .on('end', () => { this.radialDragEnd(); })
    // );
  }

  zoomed(): void {
    this.radialG.attr('transform', d3.event.transform);
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
      .attr('fill', '#d3d3d3')
      .attr('fill-opacity', OPACITY.fade)
      .attr('stroke', '#fff')
      .attr('stroke-opacity', OPACITY.full)
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
    // this.drawDonut(null, null);

    this.currentlySelectedMaxDate = this.MAX_DATE.toDate();
    this.currentlySelectedMinDate = this.MIN_DATE.toDate();

    this.radialG.selectAll('.category')
      .transition()
      .duration(250)
      .attr('opacity', OPACITY.base);

    this.radialG.selectAll('.event') // after death / event line
      .transition()
      .duration(250)
      .attr('stroke', (d: any) => { return this.colors(d.color); })
      .attr('stroke-opacity', OPACITY.fade);

    this.radialG.selectAll('.before-death')
      .transition()
      .duration(250)
      .attr('stroke', '#A5F0D6')
      .attr('stroke-opacity', OPACITY.base);

    this.chartG.selectAll('.dots')
      .transition()
      .duration(250)
      .attr('opacity', OPACITY.fade)
      .attr('fill', (d: any) => { return this.colors(d.color); });

    d3.select('#count-tooltip')
      .style('opacity', OPACITY.hide)
      .html('');

    this.resetTimeScale();
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

  /**
   * Displays brush used in both the radial and chart
   */
  showBrush(): void {
    d3.select('.selection').style('opacity', OPACITY.full).raise();
    d3.select('.radial-brush').style('opacity', OPACITY.full).raise();
  }

  /**
   * Hides both brushes used in the radial and chart 
   */
  hideBrush(): void {
    d3.select('.selection').style('opacity', OPACITY.hide).lower();
    d3.select('.radial-brush').style('opacity', OPACITY.hide).lower();
  }

  /**
   * Toggles brush behavior (visibility)
   */
  toggleBrushBehavior(): void {
    this.brushBehavior = !this.brushBehavior;

    this.brushBehavior ? this.showBrush() : this.hideBrush();
  }

  /**
   * Toggles mouse grid behavior
   */
  toggleMouseBehavior(): void {
    this.mouseBehavior = !this.mouseBehavior;
    this.radialG.select('.circle-grid').attr('opacity', () => { return this.mouseBehavior ? OPACITY.full : OPACITY.hide; });
    this.radialG.select('.text-inside').attr('opacity', () => { return this.mouseBehavior ? OPACITY.full : OPACITY.hide; });
  }

  /**
   * Toggles display of names along the circle
   */
  toggleNames(): void {
    this.showNames = !this.showNames;
    this.radialG.selectAll('.person-name').attr('opacity', () => { return this.showNames ? OPACITY.full : OPACITY.hide; });
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

    // this.setChartBrush(startDate, endDate);

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
    // people sorted alphabetically by name now
    this.currentlySelectedPeople = eventsByPeople.sort((a, b) => { return a.name.localeCompare(b.name); });

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
      .attr('stroke-opacity', (d: any) => {
        return d.startDate.isBetween(start, end, 'year') ? OPACITY.full : OPACITY.fade;
      });

    this.radialG.selectAll('.person-name')
      .attr('opacity', (d: any) => {
        if (!this.showNames) return 0;
        return peopleNamesInRange.has(d.key) ? OPACITY.full : OPACITY.hide;
      });

    this.radialG.selectAll('.category')
      .attr('opacity', (d: any) => {
        return peopleNamesInRange.has(d.key) ? OPACITY.full : OPACITY.hide;
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
      .attr('stroke-opacity', (d: any) => {
        // find bday
        let bday = d.values.filter((dd: any) => { return dd.dateName === 'Birth'; })[0];
        if (bday && bday.startDate) {
          return bday.startDate.isBetween(start, end, 'year') ? OPACITY.hide : OPACITY.fade;
        } else {
          return OPACITY.hide;
        }
      });

    this.chartG.selectAll('.dots')
      .transition()
      .duration(250)
      .attr('fill', (d: any) => {
        return d.startDate.isBetween(start, end, 'year') ? this.colors(d.color) : '#777777';
      }).attr('opacity', (d: any) => {
        return d.startDate.isBetween(start, end, 'year') ? OPACITY.base : OPACITY.fade;
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
      // console.log(this.selectedObject);
      this.radialG.select('.start').attr('opacity', OPACITY.full);
      this.radialG.selectAll('.type-dots').attr('opacity', OPACITY.full);
      this.radialG.selectAll('.type-labels').attr('opacity', OPACITY.full);
      this.radialG.selectAll('.categories').attr('opacity', OPACITY.full);
      this.radialG.selectAll('.cat-labels').attr('opacity', OPACITY.full);
    let beforeDeathLines = this.radialG.selectAll('.before-death');
    beforeDeathLines
      .transition().duration(250)
      .attr('stroke-opacity', OPACITY.full);

    let eventLines = this.radialG.selectAll('.event')
    eventLines
      .transition().duration(250)
      .attr('stroke-opacity', (d: any) => {
        d.hidden = false;
        return OPACITY.base;
      });

    let categoricalBars = this.radialG.selectAll('.category');
    categoricalBars
      .transition().duration(250)
      .attr('opacity', (d: any) => {
        d.hidden = false;
        return OPACITY.full;
      });

    let peopleNames = this.radialG.selectAll('.person-name');
    peopleNames
      .transition().duration(250)
      .attr('opacity', (d: any) => {
        if (!this.showNames) return OPACITY.hide;
        d.hidden = false;
        return OPACITY.full;
      })
      .attr('transform', (d: any, i: number) => {
        let rotate = (this.theta * i * 180 / Math.PI);
        // let today = moment();

        let radius = this.rScale(this.MAX_DATE.add(25, 'years').toDate()); // 8 year offset for text from outer circle
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
      .attr('opacity', OPACITY.full);

    let dots = this.legendSVG.selectAll('.dots');
    dots
      .transition().duration(250)
      .attr('opacity', OPACITY.fade);

    let labels = this.legendSVG.selectAll('.labels');
    labels
      .transition().duration(250)
      .attr('opacity', OPACITY.full);

    let gridLines = this.radialG.selectAll('.grid-line');
    gridLines
      .transition().duration(250)
      .attr('opacity', OPACITY.full);

      this.chartG.remove(); // remove old
      this.renderChart(this.data, 1920); // full width
  }

  /**
   * Hightlights (selects) a person
   * @param name person to highlight
   */
  highlightPerson(name: string): void {
    this.radialG.selectAll('.start').attr('opacity', OPACITY.hide);
    this.radialG.selectAll('.type-dots').attr('opacity', OPACITY.hide);
    this.radialG.selectAll('.type-labels').attr('opacity', OPACITY.hide);
    this.radialG.selectAll('.categories').attr('opacity', OPACITY.hide);
    this.radialG.selectAll('.cat-labels').attr('opacity', OPACITY.hide);

    let beforeDeathLines = this.radialG.selectAll('.before-death');
    beforeDeathLines
      .transition().duration(250)
      .attr('stroke-opacity', (d: any) => {
        d.hidden = d.key !== name ? true : false;
        return d.key !== name ? OPACITY.hide : OPACITY.full;
      });

    let listOfDates = new Array<any>();
    let eventLines = this.radialG.selectAll('.event');
    eventLines
      .transition().duration(250)
      .attr('stroke-opacity', (d: any) => {
        if (d.person === name) listOfDates.push(d);
        d.hidden = d.person !== name ? true : false;
        return d.person !== name ? OPACITY.hide : OPACITY.full;
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
        return d.key !== name ? OPACITY.hide : OPACITY.full;
      });

    let peopleNames = this.radialG.selectAll('.person-name');
    peopleNames
      .transition().duration(250)
      .attr('opacity', (d: any) => { return d.key !== name ? OPACITY.hide : OPACITY.full; })
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

    let dots = this.legendSVG.selectAll('.dots');
    dots
      .transition().duration(250)
      .attr('opacity', OPACITY.hide);

    let labels = this.legendSVG.selectAll('.labels');
    labels
      .transition().duration(250)
      .attr('opacity', OPACITY.hide);

    let gridLines = this.radialG.selectAll('.grid-line');
    gridLines
      .transition().duration(250)
      .attr('opacity', OPACITY.hide);

     // update TL width
    let currTLWidth = this.chartG.attr('width');
    let panelWidth = 500;

    let newWidth = currTLWidth - panelWidth;
    this.chartG.remove(); // remove old
    this.renderChart(this.data, newWidth);

    // delay this by a bit
    setTimeout(() => {
      let timelineDots = this.chartG.selectAll('.dots');
      timelineDots
        .transition().duration(250)
        .attr('opacity', (d: any) => {
          return d.person === name ? OPACITY.full : OPACITY.hide;
        });
    }, 500);
  }

  /**
   * Mouseover handler for the circle axis grid
   */
  drawGridCircle(): void {
    if (!this.mouseBehavior) return;
    // - 25 accounts for offset in drawing (radius starts from 50)
    let mouseX = (d3.event.x - (this.WIDTH + (this.margin.left + this.margin.right - 25)) / 2);
    let mouseY = (d3.event.y - (this.HEIGHT + (this.margin.top + this.margin.bottom - 25)) / 2);

    let radius = Math.ceil(Math.sqrt(mouseX * mouseX + mouseY * mouseY));
    let date = this.rScale.invert(radius);

    // if no date range has been selected use one defined by data else use min / max selected ones
    if (!this.currentlySelectedMaxDate || !this.currentlySelectedMinDate) {
      if (moment(date).isBefore(this.MIN_DATE)) date = this.MIN_DATE.toDate();
      if (moment(date).isAfter(this.MAX_DATE)) date = this.MAX_DATE.toDate();
    } else {
      if (moment(date).isBefore(this.currentlySelectedMinDate)) date = this.currentlySelectedMinDate;
      if (moment(date).isAfter(this.currentlySelectedMaxDate)) date = this.currentlySelectedMaxDate;
    }

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
      .attr('opacity', OPACITY.full)
      .text(`${moment(date).year()}`);
  }


  /**
   * Creates the 'timelines' and plots them on the timeline
   * Timelines consist of three parts:
   * - Life span - defined as line with the class '.before-death'
   * - Post life span - defined as a dashed line with the class '.after-death'
   * - Events - lines / circles plotted on the timelines with the class '.event'
   * @param data - the data that will be rendered
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
        let personA = this.objects.find((p: PersonOrganization & Location) => { return p.name === a.key; });
        let personB = this.objects.find((p: PersonOrganization & Location) => { return p.name === b.key; });
        let catA = this.getCategory(personA, this.currentGrouping);
        let catB = this.getCategory(personB, this.currentGrouping);
        
        return catA.localeCompare(catB);
      });
    }
    this.theta = 2 * Math.PI / dataByPerson.length;
    this.nodeSizeScale = d3.scaleLinear().domain([1, this.MAX_REL_CNT]).range([5, 10]); // 4-8 range of the event lines width in px

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
        return this.getXCoordinates(this.currentlySelectedMinDate, i * this.theta);
      })
      .attr('x2', (d: any, i: number) => {
        return this.getXCoordinates(this.currentlySelectedMaxDate, i * this.theta);
      })
      .attr('y1', (d: any, i: number) => {
        return this.getYCoordinates(this.currentlySelectedMinDate, i * this.theta);
      })
      .attr('y2', (d: any, i: number) => {
        return this.getYCoordinates(this.currentlySelectedMaxDate, i * this.theta);
      })


    let beforeDeathLines = this.radialG.selectAll('.before-death').data(dataByPerson);
    beforeDeathLines
      .enter()
      .append('line')
      .attr('class', 'before-death')
      .attr('stroke', '#A5F0D6')
      .attr('stroke-width', '4px')
      .attr('data-object', null)
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
        let person = this.objects.find((p: PersonOrganization & Location) => { return p.name === d.key; });
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
      .attr('stroke', '#A5F0D6')
      .attr('data-object', (d: any) => {
        let object = this.objects.find((o: PersonOrganization & Location) => {
          return o.name === d.key;
        });
        return `${object.name}`;
      })
      .attr('x1', (d: any, i: number) => {
        if (!this.peopleAngles.has(d.key)) this.peopleAngles.set(d.key, i * this.theta);
        if (update && update.order) this.peopleAngles.set(d.key, i * this.theta);
        let birthDate = d.values.find((dd: any) => dd.dateName === 'Birth' ? dd : null);
        let date = birthDate ? birthDate.startDate : Date.now();

        if (this.currentlySelectedMinDate || this.currentlySelectedMaxDate) {
          if (moment(date).isBefore(this.currentlySelectedMinDate)) return this.getXCoordinates(this.currentlySelectedMinDate, i * this.theta);
          if (moment(date).isAfter(this.currentlySelectedMaxDate)) return this.getXCoordinates(this.currentlySelectedMaxDate, i * this.theta);
        }
        return this.getXCoordinates(date, i * this.theta);
      })
      .attr('x2', (d: any, i: number) => {
        let deathDate = d.values.find((dd: any) => dd.dateName === 'Death' ? dd : null);
        let date = deathDate ? deathDate.endDate : Date.now();

        if (this.currentlySelectedMinDate || this.currentlySelectedMaxDate) {
          if (moment(date).isBefore(this.currentlySelectedMinDate)) return this.getXCoordinates(this.currentlySelectedMinDate, i * this.theta);
          if (moment(date).isAfter(this.currentlySelectedMaxDate)) return this.getXCoordinates(this.currentlySelectedMaxDate, i * this.theta);
        }
        return this.getXCoordinates(date, i * this.theta);
      })
      .attr('y1', (d: any, i: number) => {
        let birthDate = d.values.find((dd: any) => dd.dateName === 'Birth' ? dd : null);
        let date = birthDate ? birthDate.startDate : Date.now();

        if (this.currentlySelectedMinDate || this.currentlySelectedMaxDate) {
          if (moment(date).isBefore(this.currentlySelectedMinDate)) return this.getYCoordinates(this.currentlySelectedMinDate, i * this.theta);
          if (moment(date).isAfter(this.currentlySelectedMaxDate)) return this.getYCoordinates(this.currentlySelectedMaxDate, i * this.theta);
        }
        return this.getYCoordinates(date, i * this.theta);
      })
      .attr('y2', (d: any, i: number) => {
        let deathDate = d.values.find((dd: any) => dd.dateName === 'Death' ? dd : null);
        let date = deathDate ? deathDate.endDate : Date.now();

        if (this.currentlySelectedMinDate || this.currentlySelectedMaxDate) {
          if (moment(date).isBefore(this.currentlySelectedMinDate)) return this.getYCoordinates(this.currentlySelectedMinDate, i * this.theta);
          if (moment(date).isAfter(this.currentlySelectedMaxDate)) return this.getYCoordinates(this.currentlySelectedMaxDate, i * this.theta);
        }

        return this.getYCoordinates(date, i * this.theta);
      });

    let startingPoint = this.radialG.selectAll('.start').data(['']); // clear them

    startingPoint
      .enter()
      .append('path')
      .attr('class', 'start')
      .merge(startingPoint)
      .attr('opacity', .7)
      .attr('d', () => { return d3.symbol().type(d3.symbolTriangle).size(400)(); })
      .attr('fill', '#000');

    let eventLines = this.radialG.selectAll('.event').data(data);
    eventLines
      .enter()
      .append('line')
      .attr('class', 'event')
      .attr('stroke', '#cbeabb')
      .attr('stroke-width', 0)
      .attr('stroke-linecap', 'round')
      .attr('stroke-opacity', OPACITY.base)
      .attr('data-dateid', null)
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
        let person = this.objects.find((p: PersonOrganization & Location) => { return p.name === d.person; });
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
      .on('click', (d: any) => {
        this.handleClick(d);
      })
      .merge(eventLines)
      .transition().duration(250)
      .attr('data-dateid', (d: any) => {
        return d.dateID;
      })
      .attr('stroke-opacity', (d: any) => {
        if (d.startDate.isBefore(this.currentlySelectedMinDate) || d.endDate.isAfter(this.currentlySelectedMaxDate)) {
          // isnt in view hide
          return OPACITY.hide;
        }

        return d.hidden ? OPACITY.hide : OPACITY.base;
      })
      .attr('stroke-width', (d: any) => {
        let object = this.db.getEventById(d.dateID);
        return object ? `${Math.ceil(this.nodeSizeScale(object[this.currentNodeSizing].length))}px` : '4px';
      })
      .attr('stroke', (d: any) => {
        if(d.dateName === 'Birth' || d.dateName === 'Death') return '#59a14f';
        return this.colors(d.color);
      })
      // .attr('stroke', (d: any) => { return '#A5D5E6' })
      .attr('x1', (d: any, i: number) => {
        let x = this.getXCoordinates(d.startDate.toDate(), this.peopleAngles.get(d.person));
        if (d.startDate.isBefore(this.currentlySelectedMinDate) || d.endDate.isAfter(this.currentlySelectedMaxDate)) {
          // isnt in view return null
          return null;
        }
        return x;
      })
      .attr('x2', (d: any, i: number) => {
        let x = this.getXCoordinates(d.endDate.toDate(), this.peopleAngles.get(d.person));
        if (d.startDate.isBefore(this.currentlySelectedMinDate) || d.endDate.isAfter(this.currentlySelectedMaxDate)) {
          // isnt in view return null
          return null;
        }
        return x;
      })
      .attr('y1', (d: any, i: number) => {
        let y = this.getYCoordinates(d.startDate.toDate(), this.peopleAngles.get(d.person));
        if (d.startDate.isBefore(this.currentlySelectedMinDate) || d.endDate.isAfter(this.currentlySelectedMaxDate)) {
          // isnt in view return null
          return null;
        }
        return y;
      })
      .attr('y2', (d: any, i: number) => {
        let y = this.getYCoordinates(d.endDate.toDate(), this.peopleAngles.get(d.person));
        if (d.startDate.isBefore(this.currentlySelectedMinDate) || d.endDate.isAfter(this.currentlySelectedMaxDate)) {
          // isnt in view return null
          return null;
        }
        return y;
      });

    let categories = new Set<string>();
    this.objects.forEach((p: any) => { 
      categories.add((p as any).category);
    });

    let categoricalArc = d3.arc();
    categoricalArc
      .innerRadius(() => { return this.rScale.range()[1] + 5; })
      .outerRadius(() => { return this.rScale.range()[1] + 20; })
      .startAngle((d: any) => {
        return (this.peopleAngles.get(d.key) + Math.PI / 2) - this.theta / 2;
      })
      .endAngle((d: any) => { return (this.peopleAngles.get(d.key) + Math.PI / 2) + this.theta / 2; });
    
    let oldCategories = [...categories].sort();
    oldCategories = oldCategories.filter((c: any) => { return c !== undefined; });
    this.colorGreys = d3.scaleOrdinal().domain(oldCategories).range(d3.schemeGreys[4]);
    oldCategories.push('clear');

    let categoricalBars = this.radialG.selectAll('.category').data(dataByPerson);
    categoricalBars
      .enter()
      .append('path')
      .attr('class', 'category')
      .attr('d', categoricalArc)
      .on('mouseover', (d: any) => {
        if (d.hidden) return;
        let object = this.objects.find((p: PersonOrganization & Location) => { return p.name === d.key; })
        let artistName = '';
        object.names.forEach((name: any) => {
          if (name.nameType === 'Showbiz Name') artistName = name.name;
        });
        this.tooltip.nativeElement.style.display = 'block';
        this.tooltip.nativeElement.style.top = `${d3.event.pageY}px`;
        this.tooltip.nativeElement.style.left = `${d3.event.pageX + 20}px`;
        this.tooltip.nativeElement.innerHTML = `
        <h3>${artistName !== '' ? artistName : object.name}</h3>
        ${artistName !== '' ? `<span class="aka">a.k.a. ${d.key}</span>` : ''}
        <h4>${object.objectType}</h2>
        ${object.objectType === 'Location' ? `<p>Category: ${object.locationTypes}</p>` : ''}
        ${object.objectType === 'Person' ? `<p>Category: ${(object as any).category}</p>` : ''}
        `;
      })
      .on('mouseout', () => {
        this.tooltip.nativeElement.style.display = 'none';
      })
      .on('click', (d: any) => {
        // let id = d.values[0].personID;
        // console.log(id);
        // this.handleClick(id);
        this.displayPersonDetails(d.key);
      })
      .merge(categoricalBars)
      .transition().duration(250)
      .attr('d', categoricalArc)
      .attr('stroke', '#7b7b7b')
      .attr('fill', (d: any) => {
        let person = this.objects.find((p: any) => { return p.name === d.key; });
        categories.add((person as any).category);
        return this.colorGreys((person as any).category);
      });


    let peopleNames = this.radialG.selectAll('.person-name').data(dataByPerson);

    peopleNames.
      enter()
      .append('text')
      .attr('class', 'person-name')
      .merge(peopleNames)
      .transition().duration(250)
      .text((d: any) => {
        let person = this.objects.find((p: any) => { return p.name === d.key; });
        let artistName = '';
        person.names.forEach((name: any) => {
          if (name.nameType === 'Showbiz Name') artistName = name.name;
        })
        return artistName !== '' ? artistName : d.key;
      })
      .attr('opacity', () => { return this.showNames ? OPACITY.full : OPACITY.hide; })
      .style('pointer-events', 'none')
      .style('font-size', '11px')
      .attr('transform', (d: any, i: number) => {
        let rotate = (this.theta * i * 180 / Math.PI);
        let radius = this.rScale(this.rScale.domain()[1]); // 8 year offset for text from outer circle
        radius += 25; // radial offset to draw names
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
    // let newCategories = Array<string>('Park/Field', 'Music Hall/Opera House', 'Streets/Bridges', 'Other', 'Clear');
    
    let legendDots = this.legendSVG.selectAll('.type-dots').data(oldCategories);
    legendDots
      .enter()
      .append('rect')
      .attr('class', 'type-dots')
      .merge(legendDots)
      .attr('x', -825)
      .attr('y', (d: any, i: any) => {
        return -107 + i * 25;
      })
      .attr('stroke', '#000')
      .attr('width', 14)
      .attr('height', 14)
      .attr('fill', (d: any) => { return d === 'clear' ? '#fff' : this.colorGreys(d); })
      // .attr('stroke', (d: any) => { return d === 'clear' ? '#000' : '#fff'})
      .on('click', (d: any) => {
        if(d === 'clear') {
          this.radialG.selectAll('.category').attr('opacity', OPACITY.base);
          this.filterEventsByType();
          return;
        }
        let objectIDs = new Set<string>();
        let bday: moment.Moment, dday: moment.Moment;
        this.radialG
          .selectAll('.category')
          .transition().duration(250)
          .attr('opacity', (dd: any) => {
            // let searchCats = d.split('/');

            let object = this.objects.find((o: PersonOrganization & Location) => { return o.name === dd.key; });
            switch (this.currentGrouping) {
              case 'District':
                if (object.geodata.map((g: any) => { return `${g.districtNumber}`; }).includes(d)) {
                  objectIDs.add(object.name);
                  return OPACITY.base;
                } else {
                  return OPACITY.hide;
                }
              case 'Location Type':
                // TODO: These conditions need to be updated to map from an array to the combined locationTypes we have
                // Could use d.split('/') -> then we get 2 locationTypes check for either
                // In case of Other just return everything that is not part of the main location types?
                if (object.locationTypes.includes(d)) {
                  objectIDs.add(object.name);
                  return OPACITY.base;
                } else {
                  return OPACITY.hide;
                }
              case 'Role':
                if (object.roles.includes(d)) {
                  objectIDs.add(object.name);
                  return OPACITY.base;
                } else {
                  return OPACITY.hide;
                }
              case 'Exiled':
                if (d === 'Exiled') {
                  if (object.functions.map((f: any) => { return f.dateName; }).includes('Exil')) {
                    objectIDs.add(object.name);
                    return OPACITY.base;
                  } else {
                    return OPACITY.hide;
                  }
                } else if (d === 'Not-Exiled') {
                  if (object.functions.map((f: any) => { return f.dateName; }).includes('Exil')) {
                    return OPACITY.hide;
                  } else {
                    objectIDs.add(object.name);
                    return OPACITY.base;
                  }
                }
              case 'Born after 1945':
                if (d === 'Born after 1945') {
                  for (let i = 0; i < object.dates.length; i++) {
                    let date = object.dates[i];

                    if (date.dateName === 'Birth') {
                      bday = moment(date.date);
                    }
                  }
                  if (!bday) return OPACITY.hide;

                  if (bday.isSameOrAfter('1945', 'year')) {
                    objectIDs.add(object.name);
                    return OPACITY.base;
                  } else {
                    return OPACITY.hide;
                  }
                } else if (d === 'Born before 1945') {
                  for (let i = 0; i < object.dates.length; i++) {
                    let date = object.dates[i];

                    if (date.dateName === 'Birth') {
                      bday = moment(date.date);
                    }
                  }

                  if (!bday) return OPACITY.hide;

                  if (bday.isSameOrBefore('1945', 'year')) {
                    objectIDs.add(object.name);
                    return OPACITY.base;
                  } else {
                    return OPACITY.hide;
                  }
                }
              case 'Died before 1938':
                if (d === 'Died before 1938') {
                  for (let i = 0; i < object.dates.length; i++) {
                    let date = object.dates[i];

                    if (date.dateName === 'Death') {
                      dday = moment(date.date);
                    }
                  }
                  if (!dday) return OPACITY.hide;

                  if (dday.isSameOrBefore('1938', 'year')) {
                    objectIDs.add(object.name);
                    return OPACITY.base;
                  } else {
                    return OPACITY.hide;
                  }
                } else if (d === 'Died after 1938') {
                  for (let i = 0; i < object.dates.length; i++) {
                    let date = object.dates[i];

                    if (date.dateName === 'Death') {
                      dday = moment(date.date);
                    }
                  }
                  if (!dday) return OPACITY.hide;
                  if (dday.isSameOrAfter('1938', 'year')) {
                    objectIDs.add(object.name);
                    return OPACITY.base;
                  } else {
                    return OPACITY.hide;
                  }
                }
              case 'Gender':
                if (object.gender === d) {
                  objectIDs.add(object.name);
                  return OPACITY.base;
                } else {
                  return OPACITY.hide;
                }
              case 'None':
                if (this.dataType === 'people') {
                  // default is roles
                  if (object.roles.includes(d)) {
                    objectIDs.add(object.name);
                    return OPACITY.base;
                  } else {
                    return OPACITY.hide;
                  }
                }
                if (this.dataType === 'locations') {
                  if (object.locationTypes.includes(d)) {
                    objectIDs.add(object.name);
                    return OPACITY.base;
                  } else {
                    return OPACITY.hide;
                  }
                }
            }
          });

        this.radialG
          .selectAll('.event')
          .attr('stroke-opacity', (d: any) => {
            let object = this.objects.find(o => { return o.objectId === d.personID });
            return objectIDs.has(object.name) ? OPACITY.base : OPACITY.hide;
          });

        this.radialG
          .selectAll('.before-death')
          .attr('stroke-opacity', (d: any, i: any, n: any) => {
            let dataID: string = d3.select(n[i]).attr('data-object');
            // console.log(dataID);
            // dataID is 'object:<IDENTIFIER>' -> need to split and get second argument
            // console.log(dataID.split(':')[1]);
            return objectIDs.has(dataID) ? OPACITY.base : OPACITY.hide;
          });
      });

    let legendLabels = this.legendSVG.selectAll('.type-labels').data(oldCategories);
    legendLabels
      .enter()
      .append('text')
      .attr('class', 'type-labels')
      // .transition()
      // .duration(250) 
      .merge(legendLabels)
      .attr('x', -800)
      .attr('y', (d: any, i: any) => {
        return -107 + (8 + i * 25);
      })
      .text((d: any) => {
        // let total = dataByPerson.length;
        // let people = new Set<string>();
        // peopleByCategory.forEach((pbc: any) => {
        //   if (pbc.key === d) {
        //     pbc.values.forEach((v: any) => {
        //       people.add(v.person);
        //     })
        //   }
        // });
        // let ofType = people.size;
        // let percent = Math.ceil(ofType / total * 100);
        return d; // (${percent}%)`;
      })
      .attr('text-anchor', 'left')
      .attr('alignment-baseline', 'middle');
    // let peopleByCategory = d3.nest()
    //   .key((d: any) => {
    //     let person = this.objects.find((p: PersonOrganization & Location) => {
    //       return p.name === d.person;
    //     })
    //     return this.getCategory(person, this.currentGrouping);
    //   })
    //   .entries(data);
    let themeCategories = this.colors.domain();
    themeCategories.sort();
    // themeCategories.splice(themeCategories.indexOf('exile'), 1);
    themeCategories.push('clear');
    let categoricalDots = this.legendSVG.selectAll('.categories').data(themeCategories);
    categoricalDots
      .enter()
      .append('circle')
      .attr('class', 'categories')
      .merge(categoricalDots)
      .attr('r', 7)
      .attr('fill', (d: any) => {
        return d === 'clear' ? '#fff' : this.colors(d);
      })
      .attr('stroke', '#000')
      .attr('cx', -1825)
      .attr('cy', (d: any, i: any) => {
        return -100 + i * 25;
      })
      .on('click', (d: any) => {
        d === 'clear' ? this.filterEventsByType() : this.filterEventsByType(d);
      });

    let categoricalLabels = this.legendSVG.selectAll('.cat-labels').data(themeCategories);
    categoricalLabels
      .enter()
      .append('text')
      .attr('class', 'cat-labels')
      .merge(categoricalLabels)
      .attr('x', -1840)
      .attr('y', (d: any, i: any) => {
        return -100 + i * 25;
      })
      .attr('fill', '#040404')
      .text((d: any) => {
        return `${d}`;
      })
      .attr('text-anchor', 'end')
      .attr('alignment-baseline', 'middle');

    

    legendDots.exit().remove();
    legendLabels.exit().remove();
    categoricalDots.exit().remove();
    categoricalLabels.exit().remove();

    startingPoint.exit().remove();

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
    // d3.select('.radial-brush').raise();
  }

  handleClick(object: any): void {
    // incase the objectType attribute is missing
    if (object.personOrganization) {
      object.objectType = 'Person';
      object.personID = object.personOrganization;
    }
    if (object.event) {
      object.objectType = 'Event';
      object.dateID = object.event;
    }
    if (object.location) {
      object.objectType = 'Location';
      object.personID = object.location;
    }

    switch (object.objectType) {
      case 'Event':
        this.selectedObject = this.db.getEventById(object.dateID);
        let relatedEvents = this.selectedObject.events.map((e: any) => {
          return e.event;
        });
        this.objectSelected = true;
        // Highlight related events
        this.radialG.selectAll('.before-death')
          .attr('stroke-opacity', (d: any) => {
            return d.key === this.selectedObject.name ? OPACITY.base : OPACITY.hide;
          })
          .attr('stroke', (d: any) => {
            return d.key === this.selectedObject.name ? this.colors(d.color) : '#e7e7e7'
          });

        this.radialG.selectAll('.event')
          .transition().duration(250)
          .attr('stroke', (d: any) => {
            if (d.personID === this.selectedObject.objectId) return this.colors(d.color);
            // if (d.color === 'none') return '#e7e7e7';
            // console.log(d);
            // console.log((relatedEvents.includes(d.eventID)));
            return (relatedEvents.includes(d.eventID)) ? this.colors(d.color) : '#e7e7e7';
          })
          .attr('stroke-opacity', (d: any) => {
            if (d.personID === this.selectedObject.objectId) return OPACITY.base;
            if (d.color === 'other') return OPACITY.fade;
            return (relatedEvents.includes(d.eventID)) ? OPACITY.base : OPACITY.fade;
          })
          .attr('stroke-width', (d: any) => {
            let object = this.db.getEventById(d.dateID);
            if (!object) return '4px';
            if (d.color === 'other') return `${this.nodeSizeScale(object[this.currentNodeSizing].length)}px`;
            if (d.personID === this.selectedObject.objectId) return `${this.nodeSizeScale(object[this.currentNodeSizing].length)}px`;
            return (relatedEvents.includes(d.eventID)) ? '14px' : object ? `${this.nodeSizeScale(object[this.currentNodeSizing].length)}px` : '4px';;
          });

        this.chartG.selectAll('.dots')
          .transition().duration(250)
          .attr('fill', (d: any) => {
            if (d.color === 'other') return '#e7e7e7';
            return (relatedEvents.includes(d.eventID)) ? this.colors(d.color) : '#e7e7e7';
          })
          .attr('opacity', (d: any) => {
            if (d.color === 'other') return OPACITY.fade;
            return (relatedEvents.includes(d.eventID)) ? OPACITY.base : OPACITY.fade;
          })
          .attr('r', (d: any) => {
            let object = this.db.getEventById(d.dateID);
            if (!object) return '4px;'
            if (d.color === 'other') return `${this.nodeSizeScale(object[this.currentNodeSizing].length)}px`;
            return (relatedEvents.includes(d.eventID)) ? '14px' : object ? `${this.nodeSizeScale(object[this.currentNodeSizing].length)}px` : '4px';;
          });
        break;
      case 'Person':
        // this case is handled by the category click event listener
        // and uses displayPersonDetails() function instead 
        this.selectedObject = this.db.getPersonById(object.personID);
        this.objectSelected = true;
        break;
      case 'Location':
        this.selectedObject = this.db.getLocationById(object.personID);
        this.objectSelected = true;
        break;
      case 'Source':
        // this.selectedObject = this.db.getSourceById(object.personID);
        break;
      default:
        break;
    }
  }

  /**
   * Mouseout event handler - resets vis depending on settings (list displayed or not)
   */
  handleMouseout(): void {
    if(!this.detailPanelOpen) this.radialG.select('.start').attr('opacity', .5);
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

          if(this.detailPanelOpen && d.personID === this.selectedObject.objectId) {
            return d.startDate.isBetween(start, end, 'year') ? this.colors(d.color) : '#777777';  
          }
          
          return d.startDate.isBetween(start, end, 'year') ? this.colors(d.color) : '#777777';
        })
        .attr('stroke-width', (d: any) => {
          let object = this.db.getEventById(d.dateID);
          return object ? `${Math.ceil(this.nodeSizeScale(object[this.currentNodeSizing].length))}px` : '4px';
        })
        .attr('stroke-opacity', (d: any) => {
          if(this.detailPanelOpen && d.personID === this.selectedObject.objectId) {
            return d.startDate.isBetween(start, end, 'year') ? OPACITY.base : OPACITY.fade;
          }
          return d.startDate.isBetween(start, end, 'year') ? OPACITY.base : OPACITY.fade;
        });

      this.radialG.selectAll('.person-name')
        .attr('opacity', (d: any) => {
          if (!this.showNames) return 0;
          if(this.detailPanelOpen && d.personID === this.selectedObject.objectId) {
            return OPACITY.full;
          }
          return peopleNamesInRange.has(d.key) ? OPACITY.full : OPACITY.hide;
        });

      this.radialG.selectAll('.category')
        .attr('opacity', (d: any) => {
          if(this.detailPanelOpen && d.key === this.selectedObject.name) {
            return OPACITY.full;
          }
          return peopleNamesInRange.has(d.key) ? OPACITY.full : OPACITY.hide;
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
        .attr('stroke-opacity', (d: any) => {
          // find bday
          let bday = d.values.filter((dd: any) => { return dd.dateName === 'Birth'; })[0];
          if (bday && bday.startDate) {
            return bday.startDate.isBetween(start, end, 'year') ? OPACITY.base : OPACITY.fade;
          } else {
            return OPACITY.full;
          }
        });

      this.chartG.selectAll('.dots')
        .transition()
        .duration(250)
        .attr('fill', (d: any) => {
          if(this.detailPanelOpen && d.personID === this.selectedObject.objectId) {
            return d.startDate.isBetween(start, end, 'year') ? this.colors(d.color) : '#777777';
          }
          return d.startDate.isBetween(start, end, 'year') ? this.colors(d.color) : '#777777';
        }).attr('opacity', (d: any) => {
          if(this.detailPanelOpen && d.personID === this.selectedObject.objectId) {
            return d.startDate.isBetween(start, end, 'year') ? OPACITY.base : OPACITY.fade;
          }
          return d.startDate.isBetween(start, end, 'year') ? OPACITY.base : OPACITY.fade;
        });
    }
    if (!this.showingList) {
      this.radialG.selectAll('.person-name')
        .transition().duration(250)
        .attr('opacity', (d: any) => {
          if(this.detailPanelOpen && d.personID === this.selectedObject.objectId) {
            return OPACITY.full;
          }
          if (!this.showNames) return OPACITY.hide;
          return d.hidden ? OPACITY.hide : OPACITY.full
        });

      this.radialG.selectAll('.before-death')
        .transition().duration(250)
        .attr('stroke', '#A5F0D6')
        .attr('stroke-opacity', (d: any) => { return d.hidden ? OPACITY.fade : OPACITY.full });

      this.radialG.selectAll('.category')
        .transition().duration(250)
        .attr('opacity', (d: any) => { return d.hidden ? OPACITY.hide : OPACITY.full; });

      this.radialG.selectAll('.event')
        .transition().duration(250)
        .attr('stroke-width', (d: any) => {
          let object = this.db.getEventById(d.dateID);
          return object ? `${Math.ceil(this.nodeSizeScale(object[this.currentNodeSizing].length))}px` : '4px';
        })
        .attr('stroke', (d: any) => {
          if (!this.currentFilter || this.currentFilter === 'all') return (d.dateName === 'Birth' || d.dateName === 'Death') ? '#59a14f' : this.colors(d.color);
          if(this.detailPanelOpen && d.personID === this.selectedObject.objectId) {
            return (d.dateName === 'Birth' || d.dateName === 'Death') ? '#59a14f' : this.colors(d.color);
          }
          return d.color !== this.currentFilter ? ' #e7e7e7' : ((d.dateName === 'Birth' || d.dateName === 'Death') ? '#59a14f' : this.colors(d.color));
        })
        .attr('stroke-opacity', (d: any) => { 
          if(!this.detailPanelOpen) return d.hidden ? OPACITY.fade : OPACITY.base;
          return (this.detailPanelOpen && d.personID === this.selectedObject.objectId) ? OPACITY.base : OPACITY.hide; // d.hidden ? OPACITY.fade : OPACITY.base;
        });

      this.chartG.selectAll('.dots')
        .transition().duration(250)
        // .attr('r', (d: any) => {
        //   let object = this.db.getEventById(d.dateID);
        //   console.log('wrong scaling ' + `${Math.ceil(this.nodeSizeScale(object[this.currentNodeSizing].length))}px`);
        //   return object ? `${Math.ceil(this.nodeSizeScale(object[this.currentNodeSizing].length))}px` : '4px';
        // })
        .attr('fill', (d: any) => {
          if (!this.currentFilter || this.currentFilter === 'all') return this.colors(d.color);
          return d.color !== this.currentFilter ? ' #e7e7e7' : this.colors(d.color);
        })
        .attr('r', (d: any) => {
          let object = this.db.getEventById(d.dateID);
          return object ? `${Math.ceil(this.nodeSizeScale(object[this.currentNodeSizing].length)) / 2}px` : '2px';
        })
        .attr('opacity', (d: any) => { 
          if(!this.detailPanelOpen) return d.hidden ? OPACITY.fade : OPACITY.base;
          return (this.detailPanelOpen && d.personID === this.selectedObject.objectId) ? OPACITY.base : OPACITY.hide; // d.hidden ? OPACITY.fade : OPACITY.base;
          // return d.hidden ? OPACITY.fade : OPACITY.base 
        });
    }
  }

  /**
   * Mouseover handler
   * @param dateName    - name of the event being mouseovered
   * @param dateID      - id of the event being mpuseovered
   * @param personID    - id of the person who is associated to the event
   * @param personName  - name of the person who is associated to the event
   * @param rad         - true if mouseover comes from the radial display
   */
  handleMouseover(dateName: string, dateID: string, personID: string, personName: string, rad: boolean): void {
    // if(personID !== this.selectedObject)
    this.radialG.select('.start').attr('opacity', OPACITY.hide);
    if (this.radialG && !rad) { // coming from TL
      this.radialG.selectAll('.person-name')
        .attr('opacity', (d: any) => {
          if (!this.showNames) return 0;
          return personName.localeCompare(d.key) ? OPACITY.hide : OPACITY.full;
        });

      this.radialG.selectAll('.before-death')
        .attr('stroke', (d: any) => {
          return d.key === personName ? '#A5F0D6' : '#e7e7e7';
        })
        .attr('stroke-opacity', (d: any) => {
          return d.key === personName ? OPACITY.full : OPACITY.fade;
        });

      this.radialG.selectAll('.category')
        .attr('opacity', (d: any) => {
          return d.key === personName ? OPACITY.full : OPACITY.hide;
        })

      this.radialG.selectAll('.event')
        // .transition().duration(250)
        .attr('stroke-width', (d: any) => {
          let object = this.db.getEventById(d.dateID);
          return d.dateName === dateName && d.personID === personID ? '14px' : object ? `${this.nodeSizeScale(object.peopleOrganizations.length)}px` : '4px';;
        })
        .attr('stroke', (d: any) => {
          return d.dateName === dateName && d.personID === personID ? this.colors(d.color) : '#e7e7e7';
        })
        .attr('stroke-opacity', (d: any) => {
          return d.dateName === dateName && d.personID === personID ? OPACITY.base : OPACITY.fade;
        });
      this.radialG.select(`.event[data-dateid="${dateID}"]`).raise(); // raise selection
    }

    if (this.chartG && rad) { // coming from rad
      this.chartG.selectAll('.dots')
        // .transition().duration(250)
        .attr('r', (d: any) => {
          let object = this.db.getEventById(d.dateID);
          return d.dateName === dateName && d.personID === personID ? 8 : object ? `${Math.ceil(this.nodeSizeScale(object[this.currentNodeSizing].length)) / 2}px` : '2px';
        })
        .attr('fill', (d: any) => {
          return d.dateName === dateName && d.personID === personID ? this.colors(d.color) : '#e7e7e7';
        })
        .attr('opacity', (d: any) => {
          if(this.detailPanelOpen) {
            return d.personID === this.selectedObject.objectId ? OPACITY.base : OPACITY.hide;
          }
          return d.dateName === dateName && d.personID === personID ? OPACITY.base : OPACITY.fade;
        });
    }
  }

  /**
   * Renders a timeline chart of event types (count) over time
   * @param data the dataset 
   */
  renderChart(data: Array<any>, rescale? :number): void {
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
          if (v.color !== 'other') filteredData.push(v);
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
          other: s.filter((ss: any) => { return ss.color === 'other' }).length,
        };
      })
      .entries(filteredData)

    // console.log(filteredData);

    // 2 * radius margin left and right on X
    let width = rescale ? rescale : this.timelineChart.nativeElement.clientWidth; // add the 500 px we took away when rescaling 
    this.MAX_DATE = moment('31-12-2018', 'DD-MM-YYYY');
    // radius * 2 to offset drawing points by 1 point
    this.xChartScale = d3.scaleTime().range([radius*2, width]).domain([this.MIN_DATE.toDate(), this.MAX_DATE.toDate()]); //moment('01-01-1930', 'DD-MM-YYYY')
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

    let historicEvents = [];
    this.historicEvents.forEach((h: string) => {
      let hEv = this.db.getHistoricEventById(h);
      historicEvents.push(hEv);
    });

    let histEvents = this.chartG.selectAll('.historic').data(historicEvents);

    histEvents.enter()
      .append('rect')
      .attr('class', 'historic')
      .attr('data-id', (d: any) => { return `${d.objectId}`; })
      .merge(histEvents)
      .attr('x', (d: any) => {
        return this.xChartScale(moment(d.startDate).toDate());
      })
      .attr('y', (d: any) => {
        return 0;
      })
      .attr('width', (d: any) => {
        let startX = this.xChartScale(moment(d.startDate).toDate());
        let endX = this.xChartScale(moment(d.endDate).toDate());

        return endX - startX;
      })
      .attr('height', (d: any) => {
        return timelineHeight;
      })
      .attr('fill', '#e7e7e7')
      // .attr('stroke', '#000000')
      // .attr('stroke-opacity', .5)
      .attr('fill-opacity', .35);

    // brush
    this.chartBrush = d3.brushX()
      .extent([[0, 0], [this.xChartScale.range()[1], 200]]) // 0,0 - width, height
      .on('end', this.brushing.bind(this));

    this.chartG.append('g')
      .attr('class', 'brush')
      .call(this.chartBrush);

    let histText = this.chartG.selectAll('.historic-text').data(historicEvents);
    histText.enter()
      .append('text')
      .attr('class', 'fa historic-text')
      .merge(histText)
      .attr('x', (d: any) => {
        return this.xChartScale(moment(d.startDate).toDate());
      })
      .attr('y', (d: any) => { return 25; })
      .attr('text-anchor', 'left')
      .attr('fill', '#8c8c8c')
      .attr('font-size', '20px')
      .attr('fill-opacity', OPACITY.base)
      .text('\uf05a')
      .on('mouseover', (d: any) => {
        // if (d.hidden) return;
        // if filter selected and object not of filter type - no interaction
        this.chartG.select(`.historic[data-id="${d.objectId}"]`)
          .transition().duration(250)
          .attr('fill-opacity', OPACITY.base + .4);

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

        this.tooltip.nativeElement.innerHTML = `
        <h3>${d.name}</h3>
        <p>${moment(d.startDate).format('DD/MM/YYYY')} - ${moment(d.endDate).format('DD/MM/YYYY')}</p>
        `;
        // figure out how to handle hist events
        // this.handleMouseover(d.dateName, d.dateID, d.personID, d.person, false);
      })
      .on('mouseout', (d: any) => {
        this.tooltip.nativeElement.style.display = 'none';
        this.chartG.selectAll(`.historic`)
          .transition().duration(250)
          .attr('fill-opacity', .5);

        this.handleMouseout();
      });

    let dots = this.chartG.selectAll('.dots').data(filteredData);
    let currentYear = 0;
    let offset = 0;

    // Sort the items based on their categorical attribute and in time
    dots.enter()
      .append('circle')
      .attr('class', (d: any) => {
        return `dots ${d.color}`;
      })
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('r', 0)
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
        let person = this.objects.find((p: PersonOrganization & Location) => { return p.name === d.person; });
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
      .on('click', (d: any) => {
        this.handleClick(d);
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
      .attr('r', (d: any) => {
        let object = this.db.getEventById(d.dateID);
        return object ? `${Math.ceil(this.nodeSizeScale(object[this.currentNodeSizing].length)) / 2}px` : '2px';
      })
      .attr('fill', (d: any) => {
        return this.getColorForType(d.color);
      })
      .attr('opacity', OPACITY.base);


    histEvents.exit()
      .transition().duration(250)
      // .attr()
      .remove();

    histText.exit()
      .transition().duration(250)
      .remove();

    dots.exit()
      .transition().duration(250)
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('fill', '#000')
      .remove();


    d3.select('.selection')
      .attr('fill', '#4286f4')
      .attr('fill-opacity', OPACITY.fade)
      .attr('stroke', '#fff')
      .attr('stroke-opacity', OPACITY.full);
  }

  /**
   * Sets the current node sizing parameter
   * @param sizing the sizing attribute from the selection
   */
  updateNodeSizing(sizing: string): void {
    this.currentNodeSizing = sizing;
    // update the scale extent
    let minRel = Number.MAX_VALUE;
    let maxRel = 0;
    // console.log(this..map((o) => { return o.objectType; }));

    // Find events and get their relationship count based on current node sizing strategy
    let eventIds = this.data.filter((o: any) => { return o.objectType === 'Event'; }).map((o: any) => { return o.dateID; });
    let events = new Array<Event>();
    eventIds.forEach((o: string) => {
      events.push(this.db.getEventById(o));
    });
    let relArray = events.map((e: Event) => { return e[this.currentNodeSizing].length; });
    
    this.nodeSizeScale = d3.scaleLinear().domain(d3.extent(relArray)).range([5, 10]);

    // console.log(extent);
    d3.selectAll('.event')
      .attr('stroke-width', (d: any) => {
        let object = this.db.getEventById(d.dateID);
        return object ? `${Math.ceil(this.nodeSizeScale(object[this.currentNodeSizing].length))}px` : '4px';
      });

    d3.selectAll('.dots')
      .attr('r', (d: any) => {
        let object = this.db.getEventById(d.dateID);
        return object ? `${Math.ceil(this.nodeSizeScale(object[this.currentNodeSizing].length)) / 2}px` : '2px';
      });
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

  /** TODO: Remove this
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

  // TODO: Deprecated ???
  // chartBrushing(): void {
  //   console.log('brushing');
  //   if (!d3.event.selection) return;
  //   let start = d3.event.selection[0];
  //   let end = d3.event.selection[1];

  //   let startDate = this.xChartScale.invert(start);
  //   let endDate = this.xChartScale.invert(end);


  //   this.drawDonut(this.rScale(startDate), this.rScale(endDate));
  // }

  /**
   * Event handler for the timeline brush
   * Triggered when a selection has been made
   */
  brushing(): void {
    // console.log('brushing')
    if (!d3.event.selection) return;
    let start = d3.event.selection[0];
    let end = d3.event.selection[1];

    let startDate = this.xChartScale.invert(start);
    let endDate = this.xChartScale.invert(end);
    // update date selection
    this.currentlySelectedMinDate = startDate;
    this.currentlySelectedMaxDate = endDate;

    // let exhibitionCount = 0;
    // let streetCount = 0;
    // let prizeCount = 0;
    // let memorialCount = 0;
    // let anniversaryCount = 0;
    // let conferenceCount = 0;
    // this.countByYear.forEach((c: any) => {
    //   if (moment(c.key).isBetween(this.currentlySelectedMinDate, this.currentlySelectedMaxDate, 'year')) {
    //     exhibitionCount += c.value['exhibition'];
    //     streetCount += c.value['street'];
    //     prizeCount += c.value['prize'];
    //     memorialCount += c.value['memorial'];
    //     anniversaryCount += c.value['anniversary'];
    //     conferenceCount += c.value['conference'];
    //   }
    // });
    // TODO: Provide additional stats about the selection
    // i.e., exiled vs non-exiled distribution

    // update radial selection
    // let width = end - start;
    // let tooltipBBox = (d3.select('#count-tooltip').node() as any).getBoundingClientRect();

    // let leftPos = start + width / 2 - tooltipBBox.width / 2;
    // leftPos = leftPos < 0 ? 5 : leftPos; // check left
    // leftPos = leftPos > this.timelineChart.nativeElement.clientWidth ? this.timelineChart.nativeElement.clientWidth - width : leftPos; // check right
    // d3.select('#count-tooltip')
    //   .style('left', `${leftPos}px`)
    //   .style('bottom', `calc(${this.timelineChart.nativeElement.clientHeight}px + 5px)`) // 20px from tl
    //   .style('opacity', 1)
    //   .html(
    //     `<h4>Count for ${this.displayDate(this.currentlySelectedMinDate)} - ${this.displayDate(this.currentlySelectedMaxDate)}</h4>
    //           <p style="color: ${this.colors('exhibition')}">Exhibitions ${exhibitionCount}</p>
    //           <p style="color: ${this.colors('street')}">Street-namings ${streetCount}</p>
    //           <p style="color: ${this.colors('prize')}">Prizes ${prizeCount}</p>
    //           <p style="color: ${this.colors('memorial')}">Memorials ${memorialCount}</p>
    //           <p style="color: ${this.colors('anniversary')}">Anniversaries ${anniversaryCount}</p>
    //           <p style="color: ${this.colors('conference')}">Conferences ${conferenceCount}</p>
    //           `
    //   );

    this.rescaleTime(startDate, endDate);
    // this.drawDonut(this.rScale(startDate), this.rScale(endDate));
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
