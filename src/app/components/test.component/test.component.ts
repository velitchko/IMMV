import { Component, OnInit, ViewChild, Inject, ElementRef, EventEmitter } from '@angular/core';
import { DatabaseService } from '../../services/db.service';
import { PersonOrganization } from '../../models/person.organization';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { Event } from '../../models/event';
import { environment } from '../../../environments/environment';
import * as d3 from 'd3';
import * as moment from 'moment';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

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
  currentlySelectedPeople: Array<any>;
  currentlySelectedEvents: Array<any>;

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
  angleScale: d3.ScaleLinear<number, number>;
  rScale: d3.ScaleTime<number, number>;
  colors: d3.ScaleOrdinal<string, {}>;  // d3 color coding
  categoricalColors: d3.ScaleOrdinal<string, {}>;
  /**
   *  "#006345" - dark green - exile
      "#e333af" - pink - other renamings
      "#54c53e" - light green - life line
      "#027cef" - blue - rest
      "#fe444a" - red - street renaming
   */
  dragEndPoint: number;
  dragStartPoint: number;
  theta: number;
  arc: d3.Arc<any, {}>;

  // internal data structures
  orderingMap: Map<string, Map<string, any>>;
  peopleAngles: Map<string, number>;

  margin = {                                 // margin config for the svg's
    top: 50,
    bottom: 50,
    left: 50,
    right: 0
  };

  // ordering

  // Data
  people: Array<PersonOrganization>;         // people/organizations array
  data: Array<any>;                          // data in d3-ish format
  filteredData: Array<any>;                  // filteredData in d3-ish format

  // Config
  isBrowser: boolean;

  // Frontend
  eventTypes: Array<string>;
  ordering: Array<string>;
  currentOrder: string;
  personSelected: boolean;
  selectedPerson: PersonOrganization;

  // Autocomplete
  peopleCtrl: FormControl;
  filteredPeople: Observable<Array<PersonOrganization>>;


  /**
   * @param db DatabaseService - the service we use to perform database queries and get requests
   * @param window (JS) Window object - Leaflet needs this and we provide it (check app.module.ts)
   * @param _platformId Object determining if we are on the server or browser side
   */
  constructor(private db: DatabaseService, @Inject('WINDOW') private window: any, @Inject(PLATFORM_ID) private _platformId: Object) {
    this.personSelected = false;

    this.peopleCtrl = new FormControl;
    this.filteredPeople = this.peopleCtrl.valueChanges
      .pipe(
        startWith(''),
        map(person => person ? this.filterPeople(person) : this.people.slice())
      );
  
    this.people = new Array<PersonOrganization>();
    this.data = new Array<any>();

    this.theta = 0;

    this.colors = d3.scaleOrdinal()
      .domain(['street', 'exhibition', 'exile', 'prize', 'none'])
      .range(['#fe444a', '#e333af', '#006345', '#377eb8', '#54c53e']); // old none blue - #027cef

    this.categoricalColors = d3.scaleOrdinal()
      .domain(['Musician', 'Composer', 'Conductor', 'Author', 'Mixed'])
      .range(['#fff200', '#ffa500', '#ff5000', '#ff0000', '#efefef']);

    this.eventTypes = new Array<string>('street', 'exhibition');

    this.peopleAngles = new Map<string, number>();
    // meta map
    this.orderingMap = new Map<string, Map<string, any>>();
    // create maps for orderings
    this.orderingMap.set('First Post-death Event', new Map<string, moment.Moment>());
    this.orderingMap.set('Birth', new Map<string, moment.Moment>());
    this.orderingMap.set('Death', new Map<string, moment.Moment>());
    this.orderingMap.set('Honoring Time', new Map<string, moment.Moment>());

    this.ordering = Array.from(this.orderingMap.keys());

    this.currentOrder = 'Birth';

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
      this.prepareData();
    }
  }

  clearAutoComplete(): void {
    this.peopleCtrl.setValue('');
  }


  filterPeople(person: string): Array<PersonOrganization> {
    const nameVal = person.trim().toLowerCase();

    return this.people.filter((person: PersonOrganization) => {
      return person.name.trim().toLowerCase().indexOf(nameVal) === 0;
    });
  }

  resize(closed: boolean = false): void {
    // let sideNavWidth = 500; // in pixel
    // let newWidth = this.timelineContainer.nativeElement.clientWidth;
    // let newHeight = this.timelineContainer.nativeElement.clientHeight;

    // if(!closed) newWidth -= sideNavWidth;
    // TODO: Just update SVG instead of redraw if possible
    // this.render(this.data);
    if (closed) {
      // rotate back by -Math.PI
      this.timelineSVG
        .transition().duration(750)
        .attr('transform', 'rotate(0)');
        this.unhighlightPerson();
    } else {
      // rotate to Math.PI
      let currentAngle = this.peopleAngles.get(this.selectedPerson.name) * (180 / Math.PI); // to degrees
      this.timelineSVG
        .transition().duration(750)
        .attr('transform', `rotate(${180 - currentAngle})`);

      this.highlightPerson(this.selectedPerson.name);
    }
  }

  filterEventsByType(type?: string): void {
    this.data.forEach((d: any) => {
      d.hidden = false;
      if (d.color === 'exile' || d.color === 'none') return;
      if (type) d.hidden = d.color === type ? false : true;
    });

    this.render(this.data);
  }

  getEventType(eventName: string): string {
    let cat = 'none';
    if (eventName.includes('benannt')) cat = 'street';
    if (eventName.includes('Ehrenring') || eventName.includes('bürger') || eventName.includes('Preis der Stadt Wien')) cat = 'prize';
    if (eventName.includes('Ausstellung')) cat = 'exhibition';
    if (eventName.includes('Exil')) cat = 'exile';

    return cat;
  }



  addEventsToPerson(person: PersonOrganization, events: Array<Event>): void {
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
      dataPoint.personID = person.objectId;
      dataPoint.startDate = moment(event.startDate);
      dataPoint.endDate = event.endDate ? moment(event.endDate) : moment(event.startDate);
      dataPoint.dateName = event.name;
      dataPoint.type = 'post-life';
      dataPoint.color = this.getEventType(event.name ? event.name : '');
      this.data.push(dataPoint);
    });
  }

  getCategory(person: PersonOrganization): string {
    let cat = '';

    // Musician, Performer, Vocalist - 1 Cat
    // Author - 1 cat
    // Composer - 1 cat
    // Conductor - 1 cat
    // Mixed - 1 cat
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

    if (fallsIntoCat > 1) return 'Mixed';

    return cat;
    // return this.categoricalArray[Math.floor(Math.random() * 3)];
  }

  updateOrder(): void {
    let sortedMap = [...this.orderingMap.get(this.currentOrder).entries()]
      .sort((a: any, b: any) => {
        return a[1] - b[1];
      }).map((d: any) => { return d[0]; });

    this.render(this.data.sort((a: any, b: any) => {
      return sortedMap.indexOf(a.personID) - sortedMap.indexOf(b.personID);
    }), true);
  }

  /**
   * Called once the DatabaseService resolves with people/organizations
   * - Populates the @property people array 
   * - Parses the functions and dates array for each person
   * - Formats data so we can use it easily with d3
   */
  prepareData(): void {
    let themeID = '5be942be2447d22473b2e80c'; // austropop'5bc7216b69405101a3a789e9'; mdt'5be942be2447d22473b2e80c';
    this.db.getPeopleByTheme(themeID).then((success) => {
      this.people = success;
      let roles = new Set<string>();
      let themePromiseEventArray = new Array<Promise<any>>();
      success.forEach((person: any) => {
        person.roles.forEach((r: any) => {
          roles.add(r);
        });
        person.category = this.getCategory(person);
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
        let eventCounter = 0;
        peopleEvents.forEach((personEvents: any) => {
          let person = personEvents.person;
          // person.category = this.getRandomCategory();
          let events = personEvents.events;
          if (person.functions) {
            // functions
            person.functions.forEach((func: any) => {
              let dataPoint: any = {};
              if (!func.startDate) return;
              dataPoint.startDate = moment(func.startDate);
              dataPoint.endDate = func.endDate ? moment(func.endDate) : moment(func.startdate);
              dataPoint.person = person.name;
              dataPoint.dateName = func.dateName;
              dataPoint.personID = person.objectId;
              // dataPoint.category = this.getRandomCategory();
              dataPoint.color = this.getEventType(func.dateName ? func.dateName : '');
              this.data.push(dataPoint);
              eventCounter++;
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
              dataPoint.dateName = date.dateName;
              dataPoint.person = person.name;
              dataPoint.personID = person.objectId;
              // dataPoint.category = this.getRandomCategory();
              dataPoint.color = this.getEventType(date.dateName ? date.dateName : '');
              this.data.push(dataPoint);
              eventCounter++;
            });
          }
          this.addEventsToPerson(person, events);
          eventCounter += events.length;
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
        this.render(this.data);
      });
    });
  }

  calculateScales(width?: number, height?: number): void {
    this.WIDTH = width ? width : this.timelineContainer.nativeElement.clientWidth;
    this.HEIGHT = height ? height : this.timelineContainer.nativeElement.clientHeight;

    // our temporal range based on the data
    this.MIN_DATE = d3.min(this.data.map((d: any) => { return moment(d.startDate, ['YYYY-MM-DD',]); }));
    this.MAX_DATE = moment(); // d3.max(this.data.map((d: any) => { return moment(d.endDate, ['YYYY-MM-DD']); })); 

    this.xScale = d3.scaleTime().domain([this.MIN_DATE, this.MAX_DATE]).range([0, (this.WIDTH - this.margin.left)]);
    this.yScale = d3.scaleLinear().range([0, (this.HEIGHT - (this.margin.top + this.margin.bottom))]);

    this.rScale = d3.scaleTime().domain([this.MIN_DATE, this.MAX_DATE]).range([50, Math.min((this.WIDTH - this.margin.left) / 2, (this.HEIGHT - (this.margin.top + this.margin.bottom)) / 2)]);
    this.angleScale = d3.scaleLinear().range([0, 360]); // circle 0-360 degrees
  }

  getXCoordinates(date: Date, angle: number): number {
    return Math.cos(angle) * this.rScale(date);
  }

  getYCoordinates(date: Date, angle: number): number {
    return Math.sin(angle) * this.rScale(date);
  }

  displayPersonDetails(name: string): void {
    this.personSelected = true;
    this.selectedPerson = this.people.find((p: PersonOrganization) => { return p.name === name; });
    this.resize(); // notify that we have opened the side panel

  }

  closePersonDetails(): void {
    this.personSelected = false;
    this.selectedPerson = undefined;
    this.resize(true); // notify that we have closed the side panel
  }

  /**
   * Creates the timeline SVG 
   * Creates d3 zoom behavior 
   * Creates d3 brush behavior
   */
  createTimeline(): void {
    // get the x,y scales so we can draw things

    this.timelineSVG = d3.select(this.timelineContainer.nativeElement)
      .append('svg')
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

    this.g = g.append('g')
      .attr('width', this.WIDTH)
      .attr('height', this.HEIGHT)
      .attr('transform', `translate(${this.margin.top}, ${this.margin.left})`);
    // set display range
    this.currentlySelectedMinDate = this.MIN_DATE.toDate();
    this.currentlySelectedMaxDate = this.MAX_DATE.toDate();
  }

  drawDonut(startRadius: number, endRadius: number): void {
    this.g.select('#arc-selection').remove();

    if (!this.arc) this.arc = d3.arc();

    this.arc
      .innerRadius(startRadius)
      .outerRadius(endRadius)
      .startAngle(0)
      .endAngle(2 * Math.PI);
    // ({
    //   innerRadius: this.innerRadius,
    //   outerRadius: this.outerRadius,
    //   startAngle: 0,
    //   endAngle: 2*Math.PI
    // }); // "M0,-100A100,100,0,0,1,100,0L0,0Z"

    this.g.append('path')
      .attr('d', this.arc)
      .attr('fill', '#000')
      .attr('id', 'arc-selection')
      .lower();
    // .attr('')
    // .attr('transform', 'translate(200,200)')
  }

  dragStart(): void {
    // console.log(d3.event);
    let mouseClickX = d3.event.x - (this.WIDTH / 2);
    let mouseClickY = d3.event.y - (this.HEIGHT / 2);

    let sqrt = Math.ceil(Math.sqrt(mouseClickX * mouseClickX + mouseClickY * mouseClickY));

    let date = moment(this.rScale.invert(sqrt));

    if (date.isBefore(this.MIN_DATE)) sqrt = this.rScale(this.MIN_DATE);
    this.dragStartPoint = sqrt;
  }

  dragging(): void {
    let mouseClickX = d3.event.x - (this.WIDTH / 2);
    let mouseClickY = d3.event.y - (this.HEIGHT / 2);

    let sqrt = Math.ceil(Math.sqrt(mouseClickX * mouseClickX + mouseClickY * mouseClickY));

    let date = moment(this.rScale.invert(sqrt));

    if (date.isAfter(this.MAX_DATE)) sqrt = this.rScale(this.MAX_DATE);

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
  }

  dragEnd(): void {
    this.dragStartPoint = 0;
    this.dragEndPoint = 0;
    this.getDataInRange(this.currentlySelectedMinDate, this.currentlySelectedMaxDate);
  }

  getDataInRange(start: Date, end: Date): void {
    let events = new Array<any>();
    // let people = new Set<any>();

    this.data.forEach((d: any) => {
      if (d.startDate.isAfter(start) && d.endDate.isBefore(end)) {
        events.push(d);
        // people.add(d.person);
      }
    });

    this.currentlySelectedEvents = events;

    // get sorted list of events by person descending
    let eventsByPeople = d3.nest()
      .key((d: any) => {
        return d.person;
      })
      .entries(events)
      .sort((a: any, b: any) => {
        return a.values.length - b.values.length;
      })
      .reverse()
      .map((d: any) => { return { name: d.key, events: d.values.length }; });

    this.currentlySelectedPeople = eventsByPeople;
  }

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

  unhighlightPerson(): void {
    let beforeDeathLines = this.g.selectAll('.before-death');
    beforeDeathLines
      .transition().duration(750)
      .attr('stroke-opacity', 1);

    let eventLines = this.g.selectAll('.event')
    eventLines
      .transition().duration(750)
      .attr('stroke-opacity', 1);

    let categoricalBars = this.g.selectAll('.category');
    categoricalBars
      .transition().duration(750)
      .attr('opacity', 1);
  }

  highlightPerson(name: string): void {
    let beforeDeathLines = this.g.selectAll('.before-death');
    beforeDeathLines
      .transition().duration(750)
      .attr('stroke-opacity', (d: any) => {
        return d.key !== name ? 0 : 1;
      });

    let eventLines = this.g.selectAll('.event');
    eventLines
      .transition().duration(750)
      .attr('stroke-opacity', (d: any) => {
        return d.person !== name ? 0 : 1;
      });

    let categoricalBars = this.g.selectAll('.category');
    categoricalBars
      .transition().duration(750)
      .attr('opacity', (d: any) => {
        return d.key !== name ? 0 : 1;
      });
  }


  /**
   * Creates the 'timelines' and plots them on the timeline
   * Timelines consist of three parts:
   * - Life span - defined as line with the class '.before-death'
   * - Post life span - defined as a dashed line with the class '.after-death'
   * - Events - lines / circles plotted on the timelines with the class '.event'
   */
  render(data: Array<any>, orderUpdate: boolean = false): void {
    let personNameArray = new Set<string>();
    let dataByPerson = d3.nest()
      .key((d: any) => {
        if (!personNameArray.has(d.person)) personNameArray.add(d.person);
        return d.person;
      })
      .entries(data);

    this.theta = 2 * Math.PI / dataByPerson.length;

    this.timelineSVG.call(
      d3.drag()
        .on('start', () => { this.dragStart(); })
        .on('drag', () => { this.dragging(); })
        .on('end', () => { this.dragEnd(); })
    );

    let temporalData = d3.timeYear.range(this.MIN_DATE.toDate(), this.MAX_DATE.toDate(), 10);
    temporalData.push(moment('01-01-1945').toDate());

    let textInside = this.g
      .append('text')
      .attr('class', 'text-inside')
      .attr('text-anchor', 'middle')
      .attr('opacity', 0)
      .attr('x', 0)
      .attr('y', 0)
      .attr('dy', '.4em')
      .style('font-size', '25px')
      .text('');



    let circleAxis = this.g.selectAll('.circle-axis').data(temporalData);
    circleAxis
      .enter()
      .append('circle')
      .attr('class', 'circle-axis')
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('r', 0)
      .attr('stroke-width', 0)
      .attr('stroke', '#fff')
      .on('mouseover', (d: any, i: number, n: any) => {
        d3.select(n[i])
          .attr('stroke', '#000')
          .attr('stroke-width', 4)
          .raise();

        textInside
          .attr('opacity', 1)
          .text(moment(d).year());
      })
      .on('mouseout', (d: any, i: number, n: any) => {
        let year = moment(d).year().toString();
        // d3.select(n[i]).lower();

        if (year !== '1945') {
          d3.select(n[i])
            .attr('stroke', '#efefef')
            .attr('stroke-width', 4)
            .lower();
        }

        textInside
          .attr('opacity', 0)
          .text('');
      })
      .merge(circleAxis)
      .transition().duration(750)
      .attr('stroke', (d: any, i: number, n: any) => {
        let year = moment(d).year().toString();

        if (year === '1945') d3.select(n[i]).raise();

        return year === '1945' ? '#828282' : '#efefef';
      })
      .attr('stroke-width', (d: any) => {
        let year = moment(d).year().toString();

        return year === '1945' ? '6' : '4';
      })
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('r', (d: any) => { return Math.abs(this.rScale(d)); });

    /*******************
    * D3 ENTER + MERGE STEP *
    *******************/
    let afterDeathLines = this.g.selectAll('.after-death').data(dataByPerson);
    afterDeathLines
      .enter()
      .append('line')
      .attr('class', 'after-death')
      // .attr('stroke-opacity', .5)
      .attr('stroke-width', 4)
      // .attr('stroke-dasharray', 4)
      .attr('stroke-linecap', 'round')
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', 0)
      .attr('y2', 0)
      .merge(afterDeathLines)
      .transition().duration(750)
      // .attr('stroke-opacity', 0.5)
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
      });

    let beforeDeathLines = this.g.selectAll('.before-death').data(dataByPerson);
    beforeDeathLines
      .enter()
      .append('line')
      .attr('class', 'before-death')
      .attr('stroke', '#54c53e')
      .attr('stroke-width', 8)
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', 0)
      .attr('y2', 0)
      .on('mouseover', (d: any) => {
        let birthDate = d.values.find((dd: any) => { return dd.dateName === 'Birth'; });
        let deathDate = d.values.find((dd: any) => { return dd.dateName === 'Death'; });
        if (birthDate) birthDate = birthDate.startDate;
        if (deathDate) deathDate = deathDate.startDate;
        let age = Math.abs((birthDate ? birthDate : moment()).diff(deathDate ? deathDate : moment(), 'years'));
        this.tooltip.nativeElement.style.display = 'block';
        this.tooltip.nativeElement.style.opacity = '1';
        this.tooltip.nativeElement.style.top = `${d3.event.pageY}px`;
        this.tooltip.nativeElement.style.left = `${d3.event.pageX + 20}px`;
        this.tooltip.nativeElement.innerHTML = `
              <h3>${d.key} (${age})</h3>
              <p>Born: ${moment(birthDate).format('DD/MM/YYYY')} ${deathDate ? ` - Died: ${moment(deathDate).format('DD/MM/YYYY')}` : ''}</p>
            `;
      })
      .on('mouseout', () => {
        this.tooltip.nativeElement.style.opacity = '0';
        this.tooltip.nativeElement.style.display = 'none';
      })
      .merge(beforeDeathLines)
      .transition().duration(750)
      .attr('stroke', (d: any, i: number) => {
        return '#cbeabb';
      })
      .attr('x1', (d: any, i: number) => {
        if (!this.peopleAngles.has(d.key)) this.peopleAngles.set(d.key, i * this.theta);
        if (orderUpdate) this.peopleAngles.set(d.key, i * this.theta);
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

    let eventLines = this.g.selectAll('.event').data(data);
    eventLines
      .enter()
      .append('line')
      .attr('class', 'event')
      .attr('stroke', '#cbeabb')
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'round')
      .attr('stroke-opacity', 1)
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', 0)
      .attr('y2', 0)
      .on('mouseover', (d: any) => {
        // console.log(d);
        this.tooltip.nativeElement.style.display = 'block';
        this.tooltip.nativeElement.style.opacity = '1';
        this.tooltip.nativeElement.style.top = `${d3.event.pageY}px`;
        this.tooltip.nativeElement.style.left = `${d3.event.pageX + 20}px`;
        this.tooltip.nativeElement.innerHTML = `
              <h3>${d.person}</h3>
              <h4>${d.dateName}</h4>
              <p>${moment(d.startDate).format('DD/MM/YYYY')} ${d.startDate.diff(d.endDate, 'days') > 2 ? `- ${moment(d.endDate).format('DD/MM/YYYY')}` : ''}</p>
            `;
      })
      .on('mouseout', () => {
        this.tooltip.nativeElement.style.display = 'none';
        this.tooltip.nativeElement.style.opacity = '0';
      })
      .merge(eventLines)
      .transition().duration(750)
      .attr('stroke-opacity', (d: any) => {
        return d.hidden ? 0 : 1;
      })
      .attr('stroke-width', 8)
      .attr('stroke', (d: any) => {
        return this.colors(d.color);
      })
      // .attr('stroke', (d: any) => { return '#A5D5E6' })
      .attr('x1', (d: any, i: number) => { return this.getXCoordinates(d.startDate.toDate(), this.peopleAngles.get(d.person)); })
      .attr('x2', (d: any, i: number) => { return this.getXCoordinates(d.endDate.toDate(), this.peopleAngles.get(d.person)); })
      .attr('y1', (d: any, i: number) => { return this.getYCoordinates(d.startDate.toDate(), this.peopleAngles.get(d.person)); })
      .attr('y2', (d: any, i: number) => { return this.getYCoordinates(d.endDate.toDate(), this.peopleAngles.get(d.person)); });


    let categoricalArc = d3.arc();
    categoricalArc
      .innerRadius(() => { return this.rScale.range()[1] + 5; })
      .outerRadius(() => { return this.rScale.range()[1] + 20; })
      .startAngle((d: any) => {
        // console.log(this.peopleAngles.get(d.key));
        // console.log(this.theta);
        return (this.peopleAngles.get(d.key) + Math.PI / 2) - this.theta / 2;
      })
      .endAngle((d: any) => { return (this.peopleAngles.get(d.key) + Math.PI / 2) + this.theta / 2; });

    let categoricalBars = this.g.selectAll('.category').data(dataByPerson);
    categoricalBars
      .enter()
      .append('path')
      .attr('class', 'category')
      .attr('d', categoricalArc)
      .on('mouseover', (d: any) => {
        let person = this.people.find((p: PersonOrganization) => { return p.name === d.key; })
        this.tooltip.nativeElement.style.display = 'block';
        this.tooltip.nativeElement.style.opacity = '1';
        this.tooltip.nativeElement.style.top = `${d3.event.pageY}px`;
        this.tooltip.nativeElement.style.left = `${d3.event.pageX + 20}px`;
        this.tooltip.nativeElement.innerHTML = `
        <h3>${person.name}</h3>
        <p>Category ${(person as any).category}</p>
        `;
      })
      .on('mouseout', () => {
        this.tooltip.nativeElement.style.display = 'none';
        this.tooltip.nativeElement.style.opacity = '0';
      })
      .merge(categoricalBars)
      .transition().duration('750')
      .attr('d', categoricalArc)
      .attr('stroke', '#828282')
      .attr('fill', (d: any) => {
        let person = this.people.find((p: any) => { return p.name === d.key; });
        return this.categoricalColors((person as any).category);
      });



    /*******************
      * D3 EXIT STEP *
    *******************/
    circleAxis.exit()
      .transition().duration(750)
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('r', 0)
      .remove();

    beforeDeathLines.exit()
      .transition().duration(750)
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', 0)
      .attr('y2', 0)
      .attr('stroke', (d: any) => { return '#ffffff'; })//this.colors(d.key); })
      .remove();

    afterDeathLines.exit()
      .transition().duration(750)
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', 0)
      .attr('y2', 0)
      .attr('stroke', (d: any) => { return '#ffffff'; })//this.colors(d.key); })
      .remove();

    // reorderingHooks.exit()
    //   .transition().duration(750)
    //   .attr('cx', 0)
    //   .attr('cy', 0)
    //   .remove();

    categoricalBars.exit()
      .transition().duration(750)
      .attr('fill', '#000')
      .remove();

    eventLines.exit()
      .transition().duration(750)
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', 0)
      .attr('y2', 0)
      .attr('stroke', (d: any) => { return '#ffffff'; })//this.colors(d.key); })
      .remove();
  }

  displayDate(date: Date): string {
    return moment(date).format('MMMM Do YYYY');
  }

  getDuration(from: Date, to: Date): string {
    return Math.abs(moment(from).diff(moment(to), 'years')).toString();
  }
}
