import { Component, Input, Inject, OnChanges, AfterViewInit, SimpleChanges, ElementRef, ViewChild } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { MusicMapService } from '../../services/musicmap.service';
import { ThemeService } from '../../services/theme.service';
import { Event } from '../../models/event';
import * as d3 from 'd3';
import { Timeline, DataSet } from 'vis';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-timeline',
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss']
})

export class TimelineComponent implements AfterViewInit, OnChanges {
  @Input() items: Array<Event>;
  @Input() themeID: string;
  
  @ViewChild('detailtimeline', { static: true }) detailtimeline: ElementRef
  isBrowser: boolean;

  svg: any;
  x: any;
  y: any;
  x2: any;
  xAxis: any;
  width: number;
  height: number;
  brush: any;
  tooltip: any;
  zoom: any;
  overview: any;
  overviewTimeline: any;
  MAX_Y: number = 0;
  timeline: Timeline;

  aggregationType: string;

  highlightedItem: any;
  currentEventInterval: Array<Date>;
  currentlySelectedItems: Array<any>;

  eventsDataSet: DataSet<any>;
  removedEventsDataSet: DataSet<any>;
  groupsDataSet: DataSet<any>;

  minHeight = 20;

  constructor(@Inject(PLATFORM_ID) private _platformId: Object,
    @Inject('WINDOW') private window: any,
    private mms: MusicMapService,
    private ts: ThemeService,
    public dialog: MatDialog
  ) {
    this.currentEventInterval = new Array<Date>();
    this.currentlySelectedItems = new Array<any>();
    this.isBrowser = isPlatformBrowser(this._platformId);
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      this.setupData();
      this.createTimeline();

      this.mms.currentlySelectedTheme.subscribe((theme: string) => {
        !theme ? this.resetFilterMarkers() : this.filterMarkers(theme);
      });

      this.mms.currentlySelectedEvent.subscribe((event: string) => {
      });

      this.mms.currentAggregationItem.subscribe((type: string) => {
        if (!type) return;
        this.aggregationType = type;
        this.window.requestAnimationFrame(() => {
          this.updateOverviewTL();
        });
      });

      // subscribe to changes of the currently highlighted item
      this.mms.currentlyHighlightedItem.subscribe((highlight: any) => {
        this.highlightedItem = highlight;
        if (this.timeline) {
          this.highlightItem();
        }
      });
      // subscribe to changes in currently selected items
      this.mms.currentlySelectedEvents.subscribe((events: Array<any>) => {
        this.currentlySelectedItems = events;

        if (this.timeline) {
          this.updateEvents();
        }
      });
      // subscribe to changes of the time interval
      this.mms.currentEventInterval.subscribe((dates: Array<Date>) => {
        if (!dates) return;
        if (dates[0]) {
          this.currentEventInterval[0] = dates[0];
        }
        if (dates[1]) {
          this.currentEventInterval[1] = dates[1];
        }
        if (this.timeline) {
          this.timeline.setWindow(this.currentEventInterval[0], this.currentEventInterval[1]);
        }
      });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if(changes.items.previousValue && changes.items.currentValue) {
      // change has happened need to update markers
      this.eventsDataSet.clear();
      this.groupsDataSet.clear();
      this.items = changes.items.currentValue;
      this.setupData();
      // redraw timeline
      this.timeline.setItems(this.eventsDataSet);
      this.timeline.setGroups(this.groupsDataSet);
      this.timeline.redraw();
    }
  }

  resetFilterMarkers(): void {
    this.removedEventsDataSet.forEach((d: any) => {
      this.eventsDataSet.add(d);
    });

    this.removedEventsDataSet.clear();
    // this.timeline.redraw();
  }

  filterMarkers(themeID: string): void {
    this.eventsDataSet.forEach((d: any) => {
      if (!d.themes.map((t: any) => { return t.theme; }).includes(themeID)) {
        this.removedEventsDataSet.add(d);
        this.eventsDataSet.remove(d.id);
      } else {
          let color = this.ts.getColorForTheme(themeID);
          this.eventsDataSet.update({
            id: d.id,
            style: `color: ${color ? color : '#afafaf'};
            border-color: ${color ? color : '#afafaf'};
            background-color: ${d.type === 'range' ? (color ? color : '#afafaf') : ''};
            border-width: 8px !important;
            border-radius: 8px !important;
            height: 6px;
            opacity: 0.5;`
          })
      }
    });
    // this.timeline.redraw();
  }

  updateEvents(): void {
    if (this.currentlySelectedItems.length === 0) return;

    let removed = new Array<string>();

    this.eventsDataSet.forEach((event: any) => {
      if (!this.currentlySelectedItems.includes(event.id)) {
        removed.push(event.id);
      }
    });

    removed.forEach((r: string) => {
      let removedEvent = this.eventsDataSet.get(r);
      this.removedEventsDataSet.add(removedEvent);
      this.eventsDataSet.remove(r);
    });
  }

  resetEvents(): void {
    this.removedEventsDataSet.forEach((event: any) => {
      this.eventsDataSet.add(event);
    });

    this.removedEventsDataSet = new DataSet();
  }

  setupData(): void {
    this.removedEventsDataSet = new DataSet();
    this.eventsDataSet = new DataSet();

    // this.themeDistribution = new Map<string,any>();

    this.groupsDataSet = new DataSet();
    this.groupsDataSet.add({ id: 0, content: '' });
    this.groupsDataSet.add({ id: 1, content: '' })

    // range meaning interval default unless we detect otherwise
    this.items.forEach((i: Event) => {
      // if its a subevent we do not want to display an entry in the timeline
      if (!i.startDate) {
        return;
      }

      let color = this.ts.getThemeColorForEvent(i);

      if(this.themeID) color = this.ts.getColorForTheme(this.themeID);

      let type = 'point';
      let dateDiff = this.dateDifference(i.startDate, i.endDate);

      type = !i.endDate || i.startDate.valueOf() === i.endDate.valueOf() || dateDiff <= 1 ? 'point' : 'range';
      let dataitem = {
        group: 0,
        id: i.objectId,
        start: i.startDate,
        end: i.endDate ? i.endDate : i.startDate,
        //content: i.name,
        title: this.getHTMLTooltip(i),
        type: type,
        people: i.peopleOrganizations,
        events: i.events,
        sources: i.sources,
        themes: i.themes,
        locations: i.locations,
        color: color,
        style: `
          color: ${color ? color : '#afafaf'};
          border-color: ${color ? color : '#afafaf'};
          background-color: ${type === 'range' ? (color ? color : '#afafaf') : ''};
          border-width: 8px !important;
          border-radius: 8px !important;
          height: 6px;
          opacity: 0.5;
          `
      };
      if (i.endDate) dataitem['end'] = i.endDate;
      this.eventsDataSet.add(dataitem);
    });
  }

  /**
   * Calculates the difference between dates (in days) - accounts for timezone info too
   * @param a - first date
   * @param b - second date
   * @return result - difference between dates in days (floored)
   */
  dateDifference(a: Date, b: Date): number {
    if (!b) return;
    // a and b are javascript Date objects
    let _MS_PER_DAY = 1000 * 60 * 60 * 24;

    // Discard the time and time-zone information.
    let utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    let utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.floor((utc2 - utc1) / _MS_PER_DAY);
  }

  /**
   * Generates an HTML tooltip (as string) from the input eventA
   * @param e - the event object
   * @return string - the HTML as string
   */
  getHTMLTooltip(e: Event): string {
    //  <i class=\"material-icons\">domain</i>${e.organizations.length}
    return `<div class=\"tooltip\">
    <h3>${e.name}</h3>
    ${this.mms.prettyPrintDate(e.startDate, false)}${this.mms.prettyPrintDate(e.endDate, true)}
    <p>
      <i class=\"material-icons\">face</i>${e.peopleOrganizations.length}
      <i class=\"material-icons\">location_on</i>${e.locations.length}
      <i class=\"material-icons\">event</i>${e.events.length}
      <i class=\"material-icons\">collections</i>${e.sources.length}
      <i class=\"material-icons\">donut_large</i>${e.themes.length}
    </p>
    <p>Click for more info...</p>
    `;
  }

  goToEvent(e: Event): void {
    console.log('go to ' + e.name);
  }

  /**
   * Highlights the mouseovered items (if null resets selection)
   */
  highlightItem(): void {
    this.timeline.setSelection(this.highlightedItem);
  }

  /**
   * In the timeline we only have main events (sub or related events are excluded)
   * This function recieves an array of record ids and checks if they exist in our data set
   * @param recordIdArr - array of record ids we need
   * @return - array of record ids that exist in the datasetItems
   */
  getTimelineIds(recordIdArr: Array<any>): Array<any> {
    let ids = new Array<any>();
    for (let r of recordIdArr) {
      this.eventsDataSet.forEach((d: any) => {
        if (+r === +d.id && d.type !== 'background') {
          ids.push(+d.id);
        }
      });
    }
    return ids;
  }


  /**
   * Sorts the items array based on start date
   */
  sortByDate(): void {
    this.items.sort((a: any, b: any) => {
      // need to use .valueOf to perform Date object arithmetic in typescript
      return new Date(b.startDate).valueOf() - new Date(a.startDate).valueOf();
    }).reverse(); // reversal needed so first element has earliest starting date
  }

  /**
   * Creates the time scales and count scales for the overview timeline
   */
  createScales(resize?: boolean): void {
    // define output domain (range)
    this.x = d3.scaleTime().range([0, this.width]);
    this.x2 = d3.scaleTime().range([0, this.width]),
      this.y = d3.scaleLinear().range([this.height, 0]);
    this.xAxis = d3.axisBottom(this.x).tickFormat(d3.timeFormat("%Y"));
    // define domains (input range)
    this.x.domain(d3.extent(this.items, (d: any) => {
      return d.startDate;
    }));
    // add 1 year padding to x domain left and right
    this.x.domain(d3.extent([this.mms.startDate, this.mms.endDate]));

    this.x2.domain(this.x.domain());
    if (!resize) {
      this.mms.updateEventInterval(this.x.domain());
      // this.distribution = this.computeDistribution(this.x.domain()[0], this.x.domain()[1]); // min / max date
    }
    // FIXME: this.themeDistributions calculated after scales are made
    // should calculate it before and pass max y (count of themes)
    this.y.domain([0, 4]); //d3.max(this.distribution, (d: any) => {return d.count;})]);
  }

  /**
   * Create the neccessary HTML elements and append them to the DOM
   * @param overviewMargin - the margins for the overview timeline (d3)
   */
  createElements(overviewMargin: any, resize?: boolean): void {
    this.svg.append('defs').append('clipPath')
      .attr('id', 'clip')
      .append('rect')
      .attr('width', this.width)
      .attr('height', this.height);

    // append overview and detail groups to svg 
    this.overview = this.svg.append('g')
      .attr('class', 'overview')
      .attr('transform', 'translate(' + overviewMargin.left + ',' + overviewMargin.top + ')');
    // define brush function
    this.brush = d3.brushX()
      .extent([[0, 0], [this.width, this.height]])
      .on('brush end', this.brushed());

    this.overviewTimeline = d3.area()
      .curve(d3.curveCardinal)
      .x((d: any) => {
        return this.x(d.date);
      })
      .y0(this.height)
      .y1((d: any) => {

        //console.log(this.y2(d.count));
        return this.y(d.count);
      });

    this.overview.append('g')
      .attr('class', 'axis axis--x')
      .attr('transform', 'translate(0,' + this.height / 2 + ')') //
      .call(this.xAxis);


    // specify correctly selected interval
    this.overview.append('g')
      .attr('class', 'brush')
      .call(this.brush)
      .call(this.brush.move, resize ? [this.x(this.currentEventInterval[0]), this.x(this.currentEventInterval[1])] : this.x.range());
  }

  /**
   * Main function in this component
   * Generates scales, processes data, generates HTML elements and appends to DOM
   */
  createTimeline(resize?: boolean): void {
    // get SVG ref
    this.svg = d3.select('#overviewtimeline');

    // setup SVG dimensions and margins
    this.svg.attr('width', this.window.innerWidth);
    this.svg.attr('height', 65);
    let overviewMargin = { top: 0, right: 5, bottom: 0, left: 5 };
    this.width = +this.svg.attr('width') - overviewMargin.left - overviewMargin.right;
    this.height = +this.svg.attr('height');
    if (!resize) {
      // preprocessing
      for (let i of this.items) {
        i = this.type(i);
      }

      // sort events by date so we can then check for overlaps
      this.sortByDate();
    }
    // create d3 scales
    this.createScales(resize);

    // append HTML elements to svg
    this.createElements(overviewMargin, resize);
    if (!resize) {
      // create detail timeline
      let options = {
        showTooltips: true,
        start: this.x.domain()[0],
        end: this.x.domain()[1],
        min: this.mms.startDate, //new Date(this.x.domain()[0].getFullYear()-1, this.x.domain()[0].getMonth(), this.x.domain()[0].getDate()),
        max: this.mms.endDate, //new Date(this.x.domain()[1].getFullYear()+1, this.x.domain()[1].getMonth(), this.x.domain()[1].getDate()),
        autoResize: true,
        showCurrentTime: false,
        groupOrder: 'group',
        //  showMinorLabels: false,
        maxHeight: '100%', // map ~ 55vh
        minHeight: '100%',
        zoomMax: 3153600000000, // 100 years in ms
        zoomMin: 604800000, // 7 days in ms
        // cluster: true
        // stack: false, // default = true
        //verticalScroll: true,
      };
      this.timeline = new Timeline(this.detailtimeline.nativeElement, this.eventsDataSet, options); // this.datasetGroups
      this.timeline.on('rangechanged', this.rangeChanged());
      this.timeline.on('select', this.eventSelected());
      this.timeline.on('itemover', this.eventMouseOver());
      this.timeline.on('itemout', this.eventMouseOut());
      // x.domain returns array with 2 elements - start and end date
    }
  }

  /**
   * EventHandler(Callback) for the detail timeline when the interval changes
   */
  rangeChanged(): (properties: any) => void {
    return (properties: any) => {
      if (!properties.byUser) return;
      let dates = new Array<Date>();
      dates.push(this.timeline.getWindow().start);
      dates.push(this.timeline.getWindow().end);

      this.overview.select('.brush')
        .transition()
        .delay(100)
        .call(this.brush.move, [this.x(dates[0]), this.x(dates[1])]);

      this.mms.updateEventInterval(dates);
      let items = this.timeline.getVisibleItems(); // TODO items that are present in the current window we can now do statistics with them
    };
  };

  /**
   * Returns the event with corresponding recordId
   * @param recordId - the record id of the event
   * @return the event we found with that record id
   */
  findEvent(recordId: string): Event {
    let foundEvent = this.items.filter((e: Event) => {
      if (recordId === e.objectId) {
        return e;
      }
    });
    return foundEvent[0];
  }

  eventMouseOut(): (properties?: any) => void {
    return (properties: any) => {
      this.timeline.setSelection(null);
      this.mms.setHighlight(null);
    };
  }

  /**
   * EventHandler(Callback) for the mouseover of events
   */
  eventMouseOver(): (properties?: any) => void {
    return (properties: any) => {
      properties.item ? this.mms.setHighlight(properties.item) : this.mms.setHighlight(null);
      // this.timeline.setSelection(properties.item);
    };
  }

  /**
   * EventHandler(Callback) for the selection of events
   */
  eventSelected(): (properties?: any) => void {
    return (properties: any) => {
      properties.items[0] ? this.mms.setSelectedEvent(properties.items[0]) : this.mms.setSelectedEvent(null);
    };
  }

  /**
   * Calculates the amount of events that have occured on a monthly basis
   * @param minDate                - the starting date from which we start checking
   * @param maxDate                - the end date
   * @param aggregation (optional) - the chosen aggregation Yearly, Monthly (default), Daily
   * @return Array<any> - an array with each element having {date, count} attributes
   */
  computeDistribution(minDate: Date, maxDate: Date, theme: string = 'none', aggregation: string = 'none'): Array<any> {
    // should be able to compute this also based on the type of event
    // to allow for categoric visualziation of events

    // Step1: recieve specific theme to check count for
    // Step2: go through each temporal granularity selected and count how many themes of selected type have occurred
    // Step3: return data
    let result = new Array<any>();
    let count = 0;
    for (let d = minDate; d < maxDate;) {
      count = 0;
      this.items.forEach((e: Event) => {
        if (this.mms.checkIfInRange(d, e, aggregation)) {
          e.themes.forEach((t: any) => {
            if (t.theme.name === theme) {
              count++;
            }
          })
        }
      });

      this.MAX_Y = this.MAX_Y > count ? this.MAX_Y : count;
      // bi-monthly?
      // quarterly?
      if (aggregation === 'Yearly') {
        d.setFullYear(d.getFullYear() + 1);
      } else if (aggregation === 'Monthly') {
        d.setDate(d.getDate() + 1);
      } else {
        // default
        d.setFullYear(d.getFullYear() + 1); //d.setMonth(d.getMonth() + 1);
      }
      //if(count > 0) { -- alow for custom threshold?
      result.push({ date: new Date(d), count: count });
      //}
    }
    return result;
  }


  /**
   * Updates the overview timeline
   */
  updateOverviewTL(): void {
    console.log('updating TL');
    let themes = new Array<string>();
    for (let e of this.items) {
      for (let l of e.themes) {
        themes.push(l.theme.name);
      }
    }
    // TODO: updating - maybe assign an id along with each path as classname
    // update / replace the contents of that specific path per theme
    // per theme distribution
    // themeMap.forEach( (t: any) => {
    //   let dist = this.computeDistribution(this.x.domain()[0], this.x.domain()[1], t, this.aggregationType);
    //
    //   let area = this.overviewTimeline(dist);
    //
    //   this.overview.select('path')
    //     .attr('class', 'area')
    //     .attr('d', area)
    //     .style('fill', this.mms.getColorAssignmentForCategory(t));
    // });

    // overall distribution
    // this.distribution = this.computeDistribution(this.x.domain()[0], this.x.domain()[1], null, this.aggregationType);
    //
    // this.y.domain([0, d3.max(this.distribution, (d: any) => {
    //   return d.count;
    // })]);
    //
    // this.overviewTimeline = d3.area()
    //   .curve(d3.curveMonotoneX)
    //   .x((d: any) => {
    //     return this.x(d.date);
    //   })
    //   .y0(this.height)
    //   .y1((d: any) => {
    //     //console.log(this.y2(d.count));
    //     return this.y(d.count);
    //   });

    //
    // this.overview.select('path')
    //   .datum(this.distribution)
    //   .transition()
    //   .delay(250)
    //   .attr('d', this.overviewTimeline);

  }

  /**
   * EventHandler(Callback) occurrs when selecting an interval from the overviewtimeline
   * recomputes domains and ranges and updates detailtimeline if it exists
   */
  brushed(): () => void {
    return () => {
      if (!d3.event.sourceEvent || (d3.event.sourceEvent && d3.event.sourceEvent.type === 'zoom')) return; // ignore brush-by-zoom and changes from detail timeline
      let s = d3.event.selection || this.x2.range();
      let newDomain = s.map(this.x2.invert, this.x2); // we do not want to rewrite this.x.domain() because it leads to weird things

      if (this.timeline) {
        this.timeline.setWindow(newDomain[0], newDomain[1]);
      }
      // this.svg.select('.zoom')
      // .call(this.zoom.transform, d3.zoomIdentity.scale(this.width / (s[1] - s[0])).translate(-s[0], 0));
      this.mms.updateEventInterval(newDomain);
    }
  }

  /**
   * Converts strings to dates (preprocessing step)
   * @param d - the event object
   */
  type(d: Event): any {
    d.startDate = new Date(d.startDate);
    if (d.endDate) d.endDate = new Date(d.endDate);
    return d;
  }
}

