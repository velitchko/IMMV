import { Component, OnInit, ViewChild, Inject, ElementRef, EventEmitter } from '@angular/core';
import { DatabaseService } from '../../services/db.service';
import { PersonOrganization } from '../../models/person.organization';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { Event } from '../../models/event';
import { environment } from '../../../environments/environment';
import * as d3 from 'd3';
import * as moment from 'moment';
import { filter } from 'rxjs/operators';
// black voodoo workaround for leaflet (ReferenceError: window is not defined)
declare var L: any;

@Component({
  selector: 'app-test',
  templateUrl: './test.component.html',
  styleUrls: ['./test.component.scss']
})

export class TestComponent implements OnInit {
  // HTML 
  @ViewChild('timelineHolder') timelineContainer: ElementRef;
  @ViewChild('brushHolder') brushContainer: ElementRef;
  @ViewChild('mapHolder') mapContainer: ElementRef;
  @ViewChild('tooltip') tooltip: ElementRef;

  // display range
  currentlySelectedMinDate: Date;           // currently displayed min date (selection)
  currentlySelectedMaxDate: Date;           // currently displayed max date (selection)

  // Dimensions
  WIDTH: number;                            // width of the browsers viewport
  HEIGHT: number;                           // height of the browsers viewport
  MIN_DATE: moment.Moment;                  // min date
  MAX_DATE: moment.Moment;                  // max date

  // D3 things
  timelineSVG: any;                         // timeline svg holder
  brushSVG: any;                            // brush svg holder
  g: any;                                   // timeline group wrapper
  xScale: d3.ScaleTime<number, number>;     // timeline extent
  yScale: d3.ScaleLinear<number, number>    // horizontal extent
  colors: d3.ScaleOrdinal<string, string>;  // d3 color coding
  brush: d3.BrushBehavior<{}>;              // d3 brush
  zoom: d3.ZoomBehavior<Element, {}>;       // d3 zoom

  // Leaflet things
  map: any;
  mapMarkers: any;
  mapLines: any;

  // Data
  people: Array<PersonOrganization>;         // people/organizations array
  data: Array<any>;                          // data in d3-ish format
  filteredData: Array<any>;                  // filteredData in d3-ish format

  //internal things
  zoomEmitter: EventEmitter<any>;            // event emitter for zoom and brush events 
  personHeightMap: Map<string, number>;      // map associating people with their vertical positioning in the timeling (y-coords)
  rolePersonMap: Map<string, Array<string>>; // map associating roles to people (as objectID's)
  verticalPadding: number = 10;              // vertical padding (space-between) timelines
  margin = {                                 // margin config for the svg's
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  };

  // Config
  isBrowser: boolean;

  /**
   * @param db DatabaseService - the service we use to perform database queries and get requests
   * @param window (JS) Window object - Leaflet needs this and we provide it (check app.module.ts)
   * @param _platformId Object determining if we are on the server or browser side
   */
  constructor(private db: DatabaseService, @Inject('WINDOW') private window: any, @Inject(PLATFORM_ID) private _platformId: Object) {
    this.people = new Array<PersonOrganization>();
    this.data = new Array<any>();

    this.zoomEmitter = new EventEmitter<any>();

    this.personHeightMap = new Map<string, number>();
    this.rolePersonMap = new Map<string, Array<string>>();

    this.colors = d3.scaleOrdinal(d3.schemePaired);

    this.isBrowser = isPlatformBrowser(this._platformId);

    if (this.isBrowser) L = require('leaflet');
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
    this.db.getAllPeopleOrganizations().then((success: Array<PersonOrganization>) => {
      this.people = success;
      if (this.isBrowser) {
        // zoom behavior
        this.zoomEmitter.subscribe(($event: any) => {
          this.currentlySelectedMinDate = $event.extent[0];
          this.currentlySelectedMaxDate = $event.extent[1];
          // update main timeline
          if ($event.from === 'brush') {
            this.updateTimelineExtent($event.extent);
            return;
          }

          // update brush 
          if ($event.from === 'zoom') {
            this.updateBrushExtent($event.extent);
            return;
          }
        });
        // parse data in d3-ish format
        this.prepareData();
        // calculate extent and scales
        this.calculateScales();
        // create timeline
        this.createTimeline();
        // populate timeline(s)
        this.render(this.data);
        // create map
        this.createMap();
      }
    });
  }

  /**
   * Returns the roles in the dataset as an array of strings
   */
  getPeopleRoles(): Array<string> {
    return Array.from(this.rolePersonMap.keys());
  }

  filterByRole(role: string): void {
    let peopleWithRole = this.people.filter((person: PersonOrganization) => {
      return person.roles.includes(role);
    }).map((p: PersonOrganization) => {
      return p.objectId;
    });

    let filteredData = this.data.filter((d: any) => {
      return peopleWithRole.includes(d.personID);
    });

    this.filterData(filteredData);
  }

  /**
   * Called once the DatabaseService resolves with people/organizations
   * - Populates the @property people array 
   * - Parses the functions and dates array for each person
   * - Formats data so we can use it easily with d3
   */
  prepareData(): void {
    this.people.forEach((person: PersonOrganization, i: number) => {

      if (person.objectType !== 'Person') return; // organizations later

      // populate map
      person.roles.forEach((role: string) => {
        if (this.rolePersonMap.has(role)) {
          this.rolePersonMap.get(role).push(person.objectId);
        } else {
          this.rolePersonMap.set(role, new Array<string>(person.objectId));
        }
      });

      if (person.functions) {
        // functions
        person.functions.forEach((func: any) => {
          let dataPoint: any = {};
          if (!func.startDate) return;
          dataPoint.startDate = moment(func.startDate);
          func.endDate ? dataPoint.endDate = moment(func.endDate) : dataPoint.endDate = moment(func.startdate);
          dataPoint.person = person.name;
          dataPoint.dateName = func.dateName;
          dataPoint.personID = person.objectId;
          this.data.push(dataPoint);
        });

        // other dates
        person.dates.forEach((date: any) => {
          let dataPoint: any = {};
          dataPoint.startDate = moment(date.date);
          dataPoint.endDate = moment(date.date);
          dataPoint.dateName = date.dateName;
          dataPoint.person = person.name;
          dataPoint.personID = person.objectId;
          this.data.push(dataPoint);
        });
      }
    });
  }

  calculateScales(): void {
    this.WIDTH = this.timelineContainer.nativeElement.clientWidth;
    this.HEIGHT = this.timelineContainer.nativeElement.clientHeight;

    // our temporal range based on the data
    this.MIN_DATE = d3.min(this.data.map((d: any) => { return moment(d.startDate, ['YYYY-MM-DD',]); }));
    this.MAX_DATE = moment(); // d3.max(this.data.map((d: any) => { return moment(d.endDate, ['YYYY-MM-DD']); })); 

    this.xScale = d3.scaleTime().domain([this.MIN_DATE, this.MAX_DATE]).range([0, this.WIDTH]);
    this.yScale = d3.scaleLinear().range([0, this.HEIGHT]);
  }


  /**
   * Creates the timeline SVG 
   * Creates d3 zoom behavior 
   * Creates d3 brush behavior
   */
  createTimeline(): void {
    // get the x,y scales so we can draw things
    this.WIDTH = this.WIDTH - (this.margin.left + this.margin.right);
    this.HEIGHT = this.HEIGHT - (this.margin.top + this.margin.bottom);

    this.timelineSVG = d3.select(this.timelineContainer.nativeElement)
      .append('svg')
      .attr('width', this.WIDTH)
      .attr('height', this.HEIGHT);



    this.zoom = d3.zoom()
      .scaleExtent([1, 10])
      // .translateExtent([[0, 0], [this.WIDTH, this.HEIGHT]])
      // .extent([[0, 0],[this.WIDTH, this.HEIGHT]])
      .on('zoom', this.zoomEnd.bind(this));

    // zoom thing
    this.timelineSVG.append('rect')
      .attr('class', 'zoom')
      .attr('width', this.WIDTH)
      .attr('height', this.HEIGHT)
      .attr('transform', ``)
      .call(this.zoom);

    // group for data
    this.g = this.timelineSVG.append('g')
      .attr('class', 'group')
      .attr('width', this.WIDTH)
      .attr('height', this.HEIGHT)
      .attr('transform', `translate(${this.margin.top}, ${this.margin.left})`);

    // brush
    let brushHeight = 25;
    let brushWidth = this.WIDTH;
    this.brushSVG = d3.select(this.brushContainer.nativeElement)
      .append('svg')
      .attr('width', brushWidth)
      .attr('height', brushHeight);
    this.brushSVG.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(${this.margin.top}, ${this.margin.left})`)
      .call(
        d3.axisBottom(this.xScale)
          .ticks(d3.timeYear.every(10))
          .tickSize(10)
          .tickFormat((d: Date) => {
            return d3.timeFormat('%Y')(d);
          })
      )
      .selectAll('.tick');

    this.brush = d3.brushX()
      .extent([[0, 0], [brushWidth, brushHeight]])
      .on('brush', this.brushEnd.bind(this));
    // brush
    this.brushSVG.append('g')
      .attr('class', 'brush')
      .attr('transform', `translate(0, 0)`)
      .call(this.brush);
    // set display range
    this.currentlySelectedMinDate = this.MIN_DATE.toDate();
    this.currentlySelectedMaxDate = this.MAX_DATE.toDate();

    this.updateBrushExtent([this.MIN_DATE.toDate(), this.MAX_DATE.toDate()]);
  }

  /**
   * Creates the 'timelines' and plots them on the timeline
   * Timelines consist of three parts:
   * - Life span - defined as line with the class '.before-death'
   * - Post life span - defined as a dashed line with the class '.after-death'
   * - Events - lines / circles plotted on the timelines with the class '.event'
   */
  render(data: Array<any>): void {
    let dataByPerson = d3.nest()
      .key((d: any) => { return d.person; })
      .entries(data);

      /*******************
     * D3 ENTER + MERGE STEP *
    *******************/
    let beforeDeathLines = this.g.selectAll('.before-death').data(dataByPerson);

    beforeDeathLines
      .enter()
      .append('line')
      .attr('class', 'before-death')
      .attr('stroke', (d: any) => { return '#b5b5b5'; })//this.colors(d.key); })
      .attr('stroke-width', 4)
      .merge(beforeDeathLines)
      .attr('x1', (d: any) => {
        let date = d3.min(d.values.map((v: any) => { return v.startDate; }))
        return this.xScale(moment(date));
      })
      .attr('x2', (d: any) => {
        let date = d3.max(d.values.map((v: any) => { return v.endDate; }))
        return this.xScale(moment(date));
      })
      .attr('y1', (d: any, i: number) => {
        this.personHeightMap.set(d.key, i * (2 + this.verticalPadding));
        return i * (2 + this.verticalPadding);
      })
      .attr('y2', (d: any, i: number) => {
        return i * (2 + this.verticalPadding);
      })
      .on('mouseover', (d: any) => {
        let birthDate = d.values.find((dd: any) => { return dd.dateName === 'Birth'; }).startDate;
        let deathDate = d.values.find((dd: any) => { return dd.dateName === 'Death'; }).startDate;
        if (!deathDate) deathDate = moment();
        this.tooltip.nativeElement.style.opacity = '1';
        this.tooltip.nativeElement.style.top = `${d3.event.pageY}px`;
        this.tooltip.nativeElement.style.left = `${d3.event.pageX + 20}px`;
        this.tooltip.nativeElement.innerHTML = `
              <h2>${d.key}</h2>
              <p>Born: ${moment(birthDate).format('DD/MM/YYYY')} - Died: ${moment(deathDate).format('DD/MM/YYYY')}</p>
            `;
      })
      .on('mouseout', () => { this.tooltip.nativeElement.style.opacity = '0'; });

    let afterDeathLines = this.g.selectAll('.after-death').data(dataByPerson);
    afterDeathLines
      .enter()
      .append('line')
      .attr('class', 'after-death')
      .attr('stroke', (d: any) => { return '#b5b5b5'; })//this.colors(d.key); })
      .attr('stroke-width', 4)
      .attr('stroke-dasharray', 4)
      .merge(afterDeathLines)
      .attr('x1', (d: any) => {
        let date = d3.max(d.values.map((v: any) => { return v.endDate; }))
        return this.xScale(moment(date));
      })
      .attr('x2', (d: any) => {
        return this.xScale(moment());
      })
      .attr('y1', (d: any, i: number) => {
        return i * (2 + this.verticalPadding);
      })
      .attr('y2', (d: any, i: number) => {
        return i * (2 + this.verticalPadding);
      });

    let eventLines = this.g.selectAll('.event').data(data);
    eventLines
      .enter()
      .append('line')
      .attr('class', 'event')
      .attr('stroke-width', 8)
      .attr('stroke-linecap', 'round')
      .merge(eventLines)
      .attr('stroke', (d: any) => {
        let exiled = d.dateName.toLowerCase().includes('exil');
        return exiled ? '#ff0000' : '#b5b5b5';
      })//this.colors(d.key); })
      .attr('x1', (d: any) => { return this.xScale(d.startDate.toDate()); })
      .attr('x2', (d: any) => { return this.xScale(d.endDate.toDate()); })
      .attr('y1', (d: any) => { return this.personHeightMap.get(d.person); })
      .attr('y2', (d: any) => { return this.personHeightMap.get(d.person); })
      .on('mouseover', (d: any) => {
        // console.log(d);
        this.tooltip.nativeElement.style.opacity = '1';
        this.tooltip.nativeElement.style.top = `${d3.event.pageY}px`;
        this.tooltip.nativeElement.style.left = `${d3.event.pageX + 20}px`;
        this.tooltip.nativeElement.innerHTML = `
              <h2>${d.person}</h2>
              <h3>${d.dateName}</h3>
              <p>${moment(d.startDate).format('DD/MM/YYYY')} - ${moment(d.endDate).format('DD/MM/YYYY')}</p>
            `;
      })
      .on('mouseout', () => { this.tooltip.nativeElement.style.opacity = '0'; });

    /*******************
      * D3 EXIT STEP *
    *******************/
    beforeDeathLines.exit().remove();
    afterDeathLines.exit().remove();
    eventLines.exit().remove();
  }

  /**
   * Replaces current data with the result of selected filters 
   * @param filteredData - data that has been previously filtered
   */
  filterData(filteredData: Array<any>): void {
    this.render(filteredData);
  }

  /**
   * 
   */
  clearFilters(): void {
    this.render(this.data);
  }

  /**
   * EventHandler for selecting markers/paths (GeoJSON elements) in the map 
   * TODO: implement this function
   */
  highlightInMap(): void {

  }

  /**
   * EventHandler for D3's brushend event
   * - updates brush selection 
   * - emits selection as date array [start, end]
   * - calls to filter data
   */
  brushEnd(): void {
    if (!d3.event.sourceEvent || !d3.event.selection) return; // no selection or event
    let start = d3.event.selection.map(this.xScale.invert);
    let end = start.map(d3.timeYear.round);
    let brushDOM = d3.select('.brush');
    brushDOM.transition().duration(250).call(d3.event.target.move, end.map(this.xScale));
    let range = d3.brushSelection((brushDOM as any).node());

    let startD = this.xScale.invert(+range[0]);
    let endD = this.xScale.invert(+range[1]);

    this.zoomEmitter.emit({
      event: d3.event.sourceEvent,
      extent: [startD, endD],
      from: 'brush'
    });
  }

  /**
   * Updates the brush's extent
   * @param extent Date array [start, end]
   */
  updateBrushExtent(extent: Array<Date>): void {
    let brushDOM = this.brushSVG.select('.brush');
    brushDOM.transition().duration(250).call(this.brush.move, extent.map(this.xScale));
  }

  /**
   * EventHandler for D3's brushend event
   * - updates the timelines zoom selection
   * - emits selection as date array [start, end]
   */
  zoomEnd(): void {
    if (d3.event.sourceEvent && d3.event.sourceEvent.type === "brush") return; // ignore zoom-by-brush
    let transform = d3.event.transform;
    let newXScale = transform.rescaleX(this.xScale);
    // rescale following SVG items with the new 'zoomed' scale
    this.g.selectAll('.before-death')
      .transition()
      .duration(250)
      .attr('x1', (d: any) => {
        let date = d3.min(d.values.map((v: any) => { return v.startDate; }))
        return newXScale(moment(date));
      })
      .attr('x2', (d: any) => {
        let date = d3.max(d.values.map((v: any) => { return v.endDate; }))
        return newXScale(moment(date));
      })
      .attr('y1', (d: any, i: any) => {
        return i * (2 + this.verticalPadding);
      })
      .attr('y2', (d: any, i: any) => {
        return i * (2 + this.verticalPadding);
      });

    this.g.selectAll('.after-death')
      .transition()
      .duration(250)
      .attr('x1', (d: any) => {
        let date = d3.max(d.values.map((v: any) => { return v.endDate; }))
        return newXScale(moment(date));
      })
      .attr('x2', (d: any) => {
        return newXScale(moment());
      })
      .attr('y1', (d: any, i: number) => {
        return i * (2 + this.verticalPadding);
      })
      .attr('y2', (d: any, i: number) => {
        return i * (2 + this.verticalPadding);
      });

    this.g.selectAll('.event')
      .transition()
      .duration(250)
      .attr('x1', (d: any) => { return newXScale(d.startDate.toDate()); })
      .attr('x2', (d: any) => { return newXScale(d.endDate.toDate()); })
      .attr('y1', (d: any) => { return this.personHeightMap.get(d.person); })
      .attr('y2', (d: any) => { return this.personHeightMap.get(d.person); })

    // brush & axis
    this.zoomEmitter.emit({
      event: d3.event.sourceEvent,
      extent: newXScale.domain(),
      from: 'zoom'
    });
  }

  /**
   * Updates the timelines extent
   * @param extent Date array [start, end]
   */
  updateTimelineExtent(extent: Array<Date>): void {
    let newXScale = d3.scaleTime().domain([extent[0], extent[1]]).range([0, this.WIDTH]);
    this.g.selectAll('.before-death')
      .transition()
      .duration(250)
      .attr('x1', (d: any) => {
        let date = d3.min(d.values.map((v: any) => { return v.startDate; }))
        return newXScale(moment(date));
      })
      .attr('x2', (d: any) => {
        let date = d3.max(d.values.map((v: any) => { return v.endDate; }))
        return newXScale(moment(date));
      })
      .attr('y1', (d: any, i: any) => {
        return i * (2 + this.verticalPadding);
      })
      .attr('y2', (d: any, i: any) => {
        return i * (2 + this.verticalPadding);
      });

    this.g.selectAll('.after-death')
      .transition()
      .duration(250)
      .attr('x1', (d: any) => {
        let date = d3.max(d.values.map((v: any) => { return v.endDate; }))
        return newXScale(moment(date));
      })
      .attr('x2', (d: any) => {
        return newXScale(moment());
      })
      .attr('y1', (d: any, i: number) => {
        return i * (2 + this.verticalPadding);
      })
      .attr('y2', (d: any, i: number) => {
        return i * (2 + this.verticalPadding);
      });

    this.g.selectAll('.event')
      .transition()
      .duration(250)
      .attr('x1', (d: any) => { return newXScale(d.startDate.toDate()); })
      .attr('x2', (d: any) => { return newXScale(d.endDate.toDate()); })
      .attr('y1', (d: any) => { return this.personHeightMap.get(d.person); })
      .attr('y2', (d: any) => { return this.personHeightMap.get(d.person); })
  }

  /**
   * Creates the map using Leaflet
   */
  createMap(): void {
    let options = {
      maxBounds: L.latLngBounds(L.latLng(48.121040, 16.183696), L.latLng(48.323600, 16.541306)),
      maxZoom: 18,
      minZoom: 11,
      zoom: 12,
      zoomControl: false,
      animate: true
    };


    this.map = L.map('map-holder', options).setView([48.213939, 16.377285], 13);
    // this.map.invalidateSize();
    L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
      attribution: '', //'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
      id: 'mapbox.light', // mapbox://styles/velitchko/cjefo9eu118qd2rodaoq3cpj1
      accessToken: environment.MAPBOX_API_KEY,
      // layers: [this.markerLayerGroup, this.musicLayerGroup, this.heatmapLayerGroup, this.tagCloudLayerGroup]
    }).addTo(this.map);
  }

  displayDate(date: Date): string {
    return moment(date).format('MMMM Do YYYY');
  }
}
