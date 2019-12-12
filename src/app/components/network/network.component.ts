import { Component, OnInit, Inject, AfterViewInit, PLATFORM_ID, ViewChild, ElementRef } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { MatSnackBar } from '@angular/material';
import { FormControl } from '@angular/forms';
import { DatabaseService } from '../../services/db.service';
import { PersonOrganization } from '../../models/person.organization';
import { Location } from '../../models/location';
import { Event } from '../../models/event';
import { HistoricEvent } from '../../models/historic.event';
import { Source } from '../../models/source';
import { Theme } from '../../models/theme';
import { Observable } from 'rxjs';
import { switchMap, startWith, debounceTime, tap, finalize } from 'rxjs/operators';
import { from } from 'rxjs';
import { DataSet, Network, Timeline } from 'vis';
import * as moment from 'moment';
import * as momentIterator from 'moment-iterator';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-network',
  templateUrl: './network.component.html',
  styleUrls: ['./network.component.scss']
})
export class NetworkComponent implements AfterViewInit {
  @ViewChild('network') networkContainer: ElementRef;
  @ViewChild('timeline') timelineContainer: ElementRef;

  items: Array<Event & HistoricEvent & Location & PersonOrganization & Source & Theme>; // array to hold results from autocomplete

  isBrowser: boolean;
  pathSelection: boolean = false; // path selection mode
  typeSelected: boolean = false; // node type selection
  pathSelected: boolean = false; // when a path has been selected
  mouseOver: boolean = false;

  searchCtrl = new FormControl();
  filteredItems: Observable<any>;
  selectedNode: any;

  startDate: any;
  endDate: any;

  nodes: DataSet;
  links: DataSet;
  events: DataSet;
  colors: Map<string, string>;
  legendColor: Array<any>;
  selectedNodes: Set<any>;

  network: Network;
  timeline: Timeline;

  countByTypeAndYear: Map<string, Map<string, number>>;

  networkInitialized: boolean;
  timelineInitialized: boolean;
  loadingResults: boolean;

  relationshipMap: Map<string, string>;

  constructor(private db: DatabaseService,
    private snackBar: MatSnackBar,
    @Inject(PLATFORM_ID) private _platformId: Object, private http: HttpClient) {

    this.isBrowser = isPlatformBrowser(this._platformId);

    this.colors = new Map<string, string>();
    this.colors.set('location', '#01aef2');
    this.colors.set('personorganization', '#8ff161');
    this.colors.set('event', '#fff400');
    this.colors.set('theme', '#fa4c71');
    this.colors.set('source', '#ffb400');
    this.colors.set('historicevent', '#c000ff');

    this.legendColor = new Array<any>();
    this.legendColor.push({ display: 'Event', color: '#fff400' });
    this.legendColor.push({ display: 'Person Organization', color: '#8ff161' });
    this.legendColor.push({ display: 'Location', color: '#01aef2' });
    this.legendColor.push({ display: 'Theme', color: '#fa4c71' });
    this.legendColor.push({ display: 'Source', color: '#ffb400' });
    this.legendColor.push({ display: 'Historic Event', color: '#c000ff' });

    this.nodes = new DataSet();
    this.links = new DataSet();
    this.events = new DataSet();

    this.countByTypeAndYear = new Map<string, Map<string, number>>();

    this.items = new Array<Event & HistoricEvent & Location & PersonOrganization & Source & Theme>();
    this.selectedNodes = new Set<any>();

    this.networkInitialized = false;
    this.timelineInitialized = false;
    this.loadingResults = false;

    this.pathSelection = false;
    this.pathSelected = false;
    this.typeSelected = false;
    this.mouseOver = false;

    this.selectedNode = null;

    this.relationshipMap = new Map<string, string>();
    this.relationshipMap.set('isVersionOf', 'hasVersion');
    this.relationshipMap.set('hasVersion', 'isVersionOf');
    this.relationshipMap.set('isPartOf', 'hasPart');
    this.relationshipMap.set('hasPart', 'isPartOf');
    this.relationshipMap.set('isReferencedBy', 'references');
    this.relationshipMap.set('references', 'isReferencedBy');
    this.relationshipMap.set('isFormatOf', 'hasFormat');
    this.relationshipMap.set('hasFormat', 'isFormatOf');
    this.relationshipMap.set('isBasedOn', 'isBasisFor');
    this.relationshipMap.set('isBasisFor', 'isBasedOn');
    this.relationshipMap.set('isRequiredBy', 'requires');
    this.relationshipMap.set('requires', 'isRequiredBy');
    this.relationshipMap.set('isReplacedBy', 'replaces');
    this.relationshipMap.set('replaces', 'isReplacedBy');

    this.searchCtrl.valueChanges
      .pipe(
        debounceTime(300), // 300ms debounce
        tap(() => { this.loadingResults = true; }),
        switchMap(value => this.filterItems(value)
          .pipe(
            finalize(() => {
              this.loadingResults = false;
            }),
          )
        )
      ).subscribe(results => {
        this.filteredItems = results;
        this.loadingResults = false;
      });
  }

  ngAfterViewInit(): void { }

  getCountPerYear(startDate: Date, endDate: Date): Map<string, number> {
    let countPerYear = new Map<string, number>();

    // initiates map with each year and a count of 1
    momentIterator(moment(startDate), moment(endDate)).each('year', (d: any) => {
      countPerYear.set(d.year().toString(), 0);
    });

    return countPerYear;
  }

  // TODO: Check this function something wrong
  populateCountByTypeAndYear(): void {
    this.countByTypeAndYear = new Map<string, Map<string, number>>();
    // TODO: rethink defaults if no start or end date exists
    let minDate = moment(this.nodes.min('startDate') ? this.nodes.min('startDate').startDate : moment('01/05/1918', 'DD/MM/YYYY'));
    let maxDate = moment(this.nodes.max('endDate') ? this.nodes.max('endDate').endDate : moment('01/05/1918', 'DD/MM/YYYY'));

    let map = this.getCountPerYear(minDate.toDate(), maxDate.toDate());
    this.nodes.forEach((node: any) => {
      if (node.objectType.includes('event')) {
        if (this.countByTypeAndYear.has(node.objectType)) {
          let exists = this.countByTypeAndYear.get(node.objectType);
          exists.forEach((value: number, key: string) => {
            // inBetween(start, end, granularity, inclusion)
            if (moment.utc(key).isBetween(moment(node.startDate), moment(node.endDate), 'years', '[]')) {
              // inc value  
              exists.set(key, exists.get(key) + 1);
            }
          });
        } else {
          // for ever new node type we should create a copy of the map
          let newMap = new Map<string, number>(map);
          newMap.forEach((value: number, key: string) => {
            if (moment.utc(key).isBetween(moment(node.startDate), moment(node.endDate), 'years', '[]')) {
              // inc value  
              newMap.set(key, newMap.get(key) + 1);
            }
          });
          this.countByTypeAndYear.set(node.objectType, newMap);
        }
      }
    });

    // convert to array so d3 can understand the data
    let outputArr = new Array<any>();
    this.countByTypeAndYear.forEach((oValue: Map<string, number>, oKey: string) => {
      let tmpArr = new Array<any>();
      oValue.forEach((iValue: number, iKey: string) => {
        tmpArr.push({ date: iKey, number: iValue });
      });
      outputArr.push({ name: oKey, values: tmpArr });
    });

  }

  highlightNodeType($event: string): void {
    this.clearHighlightedNodesLinks();
    this.typeSelected = true;
    this.openSnackBar(`Highlighting ${$event} nodes`);
    let type = $event.toLowerCase().replace(' ', '').trim();

    let connectedIds = new Set<string>();
    this.nodes.forEach((node: any) => {
      if (node.objectType !== type) {
        this.nodes.update({ id: node.id, hidden: true });
      } else {
        connectedIds.add(node.id);
      }
    });

    // TODO: constraint on displayling links betweeen nodes should be relaxed
    // could find a path connecting the set of nodes above somehow and display that
    this.links.forEach((link: any) => {
      if (!connectedIds.has(link.from) && !connectedIds.has(link.to)) {
        this.links.update({ id: link.id, hidden: true });
      }
    });
  }

  toggleMouseover(): void {
    this.mouseOver = !this.mouseOver;
  }

  clearHighlightedNodesLinks(): void {
    this.typeSelected = false;
    this.nodes.forEach((node: any) => { this.nodes.update({ id: node.id, hidden: false }); });
    this.links.forEach((link: any) => { this.links.update({ id: link.id, hidden: false }); });
  }

  enablePathSelection(): void {
    this.clearHighlightedNodesLinks();
    this.pathSelection = true;
    this.openSnackBar('Path selection enabled');

    this.nodes.forEach((node: any) => {
      this.nodes.update({ id: node.id, shapeProperties: { borderDashes: [10, 10] } });
    });

    this.links.forEach((link: any) => {
      this.links.update({ id: link.id, dashes: [10, 10] });
    });
  }

  disablePathSelection(): void {
    this.pathSelection = false;

    this.openSnackBar('Path selection disabled');
    this.nodes.forEach((node: any) => {
      this.nodes.update({ id: node.id, shapeProperties: { borderDashes: false } });
    });

    this.links.forEach((link: any) => {
      this.links.update({ id: link.id, dashes: false });
    });
  }

  displayPathSelection(): void {
    this.pathSelected = true;

    this.openSnackBar('Displaying path');
    this.nodes.forEach((node: any) => {
      if (!this.selectedNodes.has(node.id)) this.nodes.update({ id: node.id, hidden: true });
    });

    this.links.forEach((link: any) => {
      if (!this.selectedNodes.has(link.from) || !this.selectedNodes.has(link.to)) {
        this.links.update({ id: link.id, hidden: true });
      } else {
        this.links.update({ id: link.id, dashes: false });
      }
    });

    this.pathSelection = false;
  }

  resetPathSelection(): void {
    this.selectedNodes = new Set<string>();
    this.pathSelected = false;
    this.disablePathSelection();
    this.clearHighlightedNodesLinks();
  }

  selectedItem(item: Event | PersonOrganization | Location | Theme | Source | HistoricEvent): void {
    switch (item.objectType) {
      case 'Event':
        this.db.getAsEvent(item).then((success) => { this.update(success); });
        break;
      case 'HistoricEvent':
        this.db.getAsHistoricEvent(item).then((success) => { this.update(success); });
        break;
      case 'Person':
        this.db.getAsPersonOrganization(item).then((success) => { this.update(success); });
        break;
      case 'Organization':
        this.db.getAsPersonOrganization(item).then((success) => { this.update(success); });
        break;
      case 'Location':
        this.db.getAsLocation(item).then((success) => { this.update(success); });
        break;
      case 'Source':
        this.db.getAsSource(item).then((success) => { this.update(success); });
        break;
      case 'Theme':
        this.db.getAsTheme(item).then((success) => { this.update(success); });
        break;
      default:
        console.log('Unknown object type');
        console.log(item);
        break;
    }
  }

  update(data: any): void {
    console.log('updating network');
    if (!this.networkInitialized) {
      this.setupData(data);
      this.initNetwork();
      this.initTimeline();
      this.populateCountByTypeAndYear();
    } else {
      this.updateData(data);
      this.populateCountByTypeAndYear();
    }
  }

  private openSnackBar(message: string) {
    this.snackBar.open(message, 'close', {
      duration: 750,
    });
  }

  filterItems(value: string): Observable<any> {
    const filterValue = value.toLowerCase();
    // use from operator (rxjs) to convert promise to observable
    return from(this.db.findObjects(filterValue));
  }

  getTotalRelationshipCount(object: any) {
    let count = 0;

    if (object.events) count += object.events.length;
    if (object.locations) count += object.locations.length;
    if (object.historicEvents) count += object.historicEvents.length;
    if (object.themes) count += object.themes.length;
    if (object.sources) count += object.sources.length;
    if (object.peopleOrganizations) count += object.peopleOrganizations.length;

    return count;
  }

  checkIfEventExists(id: string): boolean {
    return this.events.get(id);
  }

  setupData(data: Event & PersonOrganization & Location & HistoricEvent & Source & Theme): void {
    // ALL NODES (everything related to the ego node)
    if (!this.checkIfNodeExists(data.objectId)) {
      let root = data;
      root['objectType'] = data.objectType.toLowerCase();
      root['id'] = data.objectId;
      root['label'] = `${data.name} ${this.getTotalRelationshipCount(data) ? `(${this.getTotalRelationshipCount(data)})` : ''}`;
      root['color'] = this.colors.get(data.objectType.toLowerCase());
      root['hidden'] = false;

      if (root.objectType === 'person') {
        let bDay = root.dates.find((d: any) => {
          return d.dateName === 'Birth';
        });
        root.startDate = bDay.date;

        let dDay = root.dates.find((d: any) => {
          return d.dateName === 'Death';
        });

        root.endDate = dDay.date;
      }

      this.nodes.add(root);

      if (!this.checkIfEventExists(root.objectId) && root.startDate) {
        this.events.add({
          start: root.startDate,
          end: root.endDate ? root.endDate : root.startDate,
          title: root.name,
          content: root.name,
          id: root.objectId,
          type: this.getTimeType(root.startDate, root.endDate),
          className: 'event',
          style: `background-color: ${this.colors.get('event')}; border-radius: 20px;`
        });
      }
    }
    // Build data conditionally
    if (data.objectType === 'event') {
      // update event relationships
      data.events.forEach((e: { event: Event, relationship: string }) => {
        this.addDataItems(data, e, 'event');
      });
      // update theme relationships
      data.themes.forEach((e: { theme: Theme, relationship: string }) => {
        this.addDataItems(data, e, 'theme');
      });
      // update location relationships
      data.locations.forEach((e: { location: Location, relationship: string }) => {
        this.addDataItems(data, e, 'location')
      });
      // update historic event relationships
      data.historicEvents.forEach((e: { historicEvent: HistoricEvent, relationship: string }) => {
        this.addDataItems(data, e, 'historicEvent');
      });
      // update people/organization relationships
      data.peopleOrganizations.forEach((e: { personOrganization: PersonOrganization, relationship: string }) => {
        this.addDataItems(data, e, 'personOrganization')
      });
      // update source relationships
      data.sources.forEach((e: { source: Source, relationship: string}) => {
        this.addDataItems(data, e, 'source');
      });
    }

    if (data.objectType === 'person') {
      this.db.getEventsByPersonOrganization(data).then((success: Array<Event>) => {
        success.forEach((s: any) => {
          let relationship = s.peopleOrganizations.find((e: { personOrganization: any, relationship: string }) => {
            // personOrganization usually string sometimes personorganization object
            return e.personOrganization === data.objectId;
          }).relationship;

          let newNode = {
            event: s,
            relationship: this.relationshipMap.get(relationship)
          };
          this.addDataItems(data, newNode, 'event');
        });
      });
    }

    if (data.objectType === 'location') {
      this.db.getEventsByLocation(data).then((success: Array<Event>) => {
        success.forEach((s: Event) => {
          let relationship = s.locations.find((e: { location: any, relationship: string }) => {
            // location usually string sometimes location object
            return e.location === data.objectId;
            
          }).relationship;

          let newNode = {
            event: s,
            relationship: this.relationshipMap.get(relationship)
          };
          this.addDataItems(data, newNode, 'event');
        });
      });
    }

    if(data.objectType === 'source') {
      this.db.getEventsBySource(data).then((success: Array<Event>) => {
        success.forEach((s: Event) => {
          let relationship = s.sources.find((e: { source: any, relationship: string }) => {
            // source usually string sometimes source object
            return e.source === data.objectId;
          }).relationship;

          let newNode = {
            event: s,
            relationship: this.relationshipMap.get(relationship)
          };

          this.addDataItems(data, newNode, 'event');
        });
      });
    }

    if(data.objectType === 'historicevent') {
      this.db.getEventsByHistoricEvent(data).then((success: Array<Event>) => {
        success.forEach((s: Event) => {
          let relationship = s.historicEvents.find((e: { historicEvent: any, relationship: string }) => {
            // historicEvent usually string sometimes historicEvent object
            return e.historicEvent == data.objectId;
          }).relationship;

          let newNode = {
            event: s,
            relationship: this.relationshipMap.get(relationship)
          };

          this.addDataItems(data, newNode, 'event');
        });
      });
    }

    if(data.objectType === 'theme') {
      this.db.getEventsByTheme(data).then((success: Array<Event>) => {
        success.forEach((s: Event) => {
          let relationship = s.themes.find((e: { theme: any, relationship: string }) => {
            // theme usually string sometimes theme object
            return e.theme === data.objectId;
          }).relationship;

          let newNode = {
            event: s,
            relationship: this.relationshipMap.get(relationship)
          };

          this.addDataItems(data, newNode, 'event');
        });
      });
    }
  }

  checkIfNodeExists(objectId: string): boolean {
    // return this.nodes.get(objectId) !== null;
    let nodeExists = false;

    this.nodes.forEach((n: any) => {
      if (n.objectId === objectId) {
        nodeExists = true;
        return nodeExists;
      }
    });

    return nodeExists;
  }

  getTimeType(startDate: Date, endDate?: Date): string {
    let type = 'point';

    return type;
  }

  checkIfLinkExists(from: string, to: string): boolean {
    let linkExists = false;

    this.links.forEach((l: any) => {
      if (from === l.from && to === l.to ||
        from === l.to && to === l.from) {
        linkExists = true;
        return linkExists;
      }
    });

    return linkExists;
  }

  resetVis(): void {
    this.nodes.clear();
    this.links.clear();
    this.events.clear();
    this.startDate = '';
    this.endDate = '';
    this.searchCtrl.setValue('');

    this.pathSelection = false;
    this.typeSelected = false;

    this.selectedNodes = new Set<any>();
  }

  updateData(data: Event & PersonOrganization & Location & HistoricEvent & Source & Theme): void {
    if (!this.checkIfNodeExists(data.objectId)) {
      let root = data;
      root['objectType'] = 'event';
      root['id'] = root.objectId;
      root['label'] = `${root.name} ${this.getTotalRelationshipCount(root) ? `(${this.getTotalRelationshipCount(root)})` : ''})`;
      root['color'] = this.colors.get('event');
      root['shape'] = 'box';
      root['hidden'] = false;
      this.nodes.add(root);
      if (!this.checkIfEventExists(root.objectId) && root.startDate) {
        this.events.add({
          start: root.startDate,
          end: root.endDate ? root.endDate : root.startDate,
          title: root.name,
          id: root.objectId,
          content: root.name,
          type: this.getTimeType(root.startDate, root.endDate),
          className: 'event',
          style: `background-color: ${this.colors.get('event')}; border-radius: 20px;`
        });
      }
    }

     // Build data conditionally
     if (data.objectType === 'event') {
      // update event relationships
      data.events.forEach((e: { event: Event, relationship: string }) => {
        this.addDataItems(data, e, 'event');
      });
      // update theme relationships
      data.themes.forEach((e: { theme: Theme, relationship: string }) => {
        this.addDataItems(data, e, 'theme');
      });
      // update location relationships
      data.locations.forEach((e: { location: Location, relationship: string }) => {
        this.addDataItems(data, e, 'location')
      });
      // update historic event relationships
      data.historicEvents.forEach((e: { historicEvent: HistoricEvent, relationship: string }) => {
        this.addDataItems(data, e, 'historicEvent');
      });
      // update people/organization relationships
      data.peopleOrganizations.forEach((e: { personOrganization: PersonOrganization, relationship: string }) => {
        this.addDataItems(data, e, 'personOrganization')
      });
      // update source relationships
      data.sources.forEach((e: { source: Source, relationship: string}) => {
        this.addDataItems(data, e, 'source');
      });
    }

    if (data.objectType === 'person') {
      this.db.getEventsByPersonOrganization(data).then((success: Array<Event>) => {
        success.forEach((s: any) => {
          let relationship = s.peopleOrganizations.find((e: { personOrganization: any, relationship: string }) => {
            // personOrganization usually string sometimes personorganization object
            return e.personOrganization === data.objectId;
          }).relationship;

          let newNode = {
            event: s,
            relationship: this.relationshipMap.get(relationship)
          };
          this.addDataItems(data, newNode, 'event');
        });
      });
    }

    if (data.objectType === 'location') {
      this.db.getEventsByLocation(data).then((success: Array<Event>) => {
        success.forEach((s: Event) => {
          let relationship = s.locations.find((e: { location: any, relationship: string }) => {
            // location usually string sometimes location object
            return e.location === data.objectId;
            
          }).relationship;

          let newNode = {
            event: s,
            relationship: this.relationshipMap.get(relationship)
          };
          this.addDataItems(data, newNode, 'event');
        });
      });
    }

    if(data.objectType === 'source') {
      this.db.getEventsBySource(data).then((success: Array<Event>) => {
        success.forEach((s: Event) => {
          let relationship = s.sources.find((e: { source: any, relationship: string }) => {
            // source usually string sometimes source object
            return e.source === data.objectId;
          }).relationship;

          let newNode = {
            event: s,
            relationship: this.relationshipMap.get(relationship)
          };

          this.addDataItems(data, newNode, 'event');
        });
      });
    }

    if(data.objectType === 'historicevent') {
      this.db.getEventsByHistoricEvent(data).then((success: Array<Event>) => {
        success.forEach((s: Event) => {
          let relationship = s.historicEvents.find((e: { historicEvent: any, relationship: string }) => {
            // historicEvent usually string sometimes historicEvent object
            return e.historicEvent == data.objectId;
          }).relationship;

          let newNode = {
            event: s,
            relationship: this.relationshipMap.get(relationship)
          };

          this.addDataItems(data, newNode, 'event');
        });
      });
    }

    if(data.objectType === 'theme') {
      this.db.getEventsByTheme(data).then((success: Array<Event>) => {
        success.forEach((s: Event) => {
          let relationship = s.themes.find((e: { theme: any, relationship: string }) => {
            // theme usually string sometimes theme object
            return e.theme === data.objectId;
          }).relationship;

          let newNode = {
            event: s,
            relationship: this.relationshipMap.get(relationship)
          };

          this.addDataItems(data, newNode, 'event');
        });
      });
    }

    this.timeline.focus(this.events.map((e: any) => { return e.id; }), { animation: { duration: 250, easingFunction: 'easeInOutCubic' } });
    this.getMinMaxDate();
  }

  addEvent(event: Event, parent: any): void {
    if (!this.checkIfNodeExists(event.objectId)) {
      let root = event;
      root['objectType'] = 'event';
      root['id'] = root.objectId;
      root['label'] = `${root.name} ${this.getTotalRelationshipCount(root) ? `(${this.getTotalRelationshipCount(root)})` : ''})`;
      root['color'] = this.colors.get('event');
      root['shape'] = 'box';
      root['hidden'] = false;
      this.nodes.add(root);
      if (!this.checkIfEventExists(root.objectId) && root.startDate) {
        this.events.add({
          start: root.startDate,
          end: root.endDate ? root.endDate : root.startDate,
          title: root.name,
          id: root.objectId,
          content: root.name,
          type: this.getTimeType(root.startDate, root.endDate),
          className: 'event',
          style: `background-color: ${this.colors.get('event')}; border-radius: 20px;`
        });
      }
    }

    if (this.checkIfLinkExists(parent.objectId, event.objectId)) {
      return;
    }

    let label = event.themes.find((e: any) => {
      return e.theme === parent.objectId;
    }).relationship;

    this.links.add({
      source: parent,
      from: parent.objectId,
      target: event,
      to: event.objectId,
      label: label,
      color: this.colors.get('theme'),
      hidden: false,
      font: {
        align: 'middle'
      }
    });
  }

  addDataItems(parent: any, data: any, type: string): void {
    // TODO: Why do we need the [type] here when accessing objectID's?
    // Refactor this function
    console.log(parent);
    console.log(data);
    console.log(data[type]);
    console.log(type);
    console.log('----------');
    if (!this.checkIfNodeExists(data[type].objectId)) {
      // create node and add to nodes
      let node = data[type];
      node['objectType'] = type.toLowerCase();
      node['id'] = data[type].objectId;
      node['label'] = `${data[type].name} ${this.getTotalRelationshipCount(data[type]) ? `(${this.getTotalRelationshipCount(data[type])})` : ''}`;
      node['color'] = this.colors.get(type.toLowerCase());
      node['hidden'] = false;
      this.nodes.add(node);

      // create event from node and add to events (TL)
      if ((node.objectType === 'event' || node.objectType === 'historicevent') && node.startDate) {
        this.events.add({
          start: node.startDate,
          end: node.endDate ? node.endDate : node.startDate,
          title: node.name,
          id: node.objectId,
          content: node.name,
          type: (node.objectType === 'event') ? 'point' : 'background',
          style: (node.objectType === 'event') ? `background-color: ${this.colors.get(type.toLowerCase())}; border-radius: 20px;` : `background-color: ${this.colors.get(type.toLowerCase())}0D;`
        });
      }

      // create links for node and add to links
      if (this.checkIfLinkExists(parent.objectId, data[type].objectId)) return;
      this.links.add({
        source: data,
        from: parent.objectId,
        target: data[type],
        to: data[type].objectId,
        label: data.relationship,
        color: this.colors.get(type.toLowerCase()),
        hidden: false,
        font: {
          align: 'middle'
        }
      });
    } else {
      if (this.checkIfLinkExists(parent.objectId, data[type].objectId)) return;
      this.links.add({
        source: data,
        from: parent.objectId,
        target: data[type],
        to: data[type].objectId,
        label: data.relationship,
        color: this.colors.get(type.toLowerCase()),
        hidden: false,
        font: {
          align: 'middle'
        }
      });
    }
  }

  lookupItem(item: any): void {
    switch (item.objectType) {
      case 'event':
        this.db.getAsEvent(item).then((success) => {
          this.updateData(success);
          this.populateCountByTypeAndYear();
        });
        return;
      case 'historicevent':
        this.db.getAsHistoricEvent(item).then((success) => {
          this.updateData(success);
          this.populateCountByTypeAndYear();
        });
        return;
      case 'location':
        this.db.getAsLocation(item).then((success) => {
          this.updateData(success);
          this.populateCountByTypeAndYear();
        });
        return;
      case 'theme':
        // reverse lookup related events
        this.db.getEventsByTheme(item).then((success) => {
          success.forEach((s: Event) => { this.addEvent(s, item); });
        });
        // get themes too
        this.db.getAsTheme(item).then((success) => {
          this.updateData(success);
          this.populateCountByTypeAndYear();
        });
        return;
      case 'source':
        this.db.getAsSource(item).then((success) => {
          this.updateData(success);
          this.populateCountByTypeAndYear();
        });
        return;
      case 'personorganization':
        this.db.getAsPersonOrganization(item).then((success) => {
          this.updateData(success);
          this.populateCountByTypeAndYear();
        });
        return;
      default: return;
    }
  }

  initNetwork(): void {
    let data = {
      nodes: this.nodes,
      edges: this.links
    };

    let options = {
      nodes: {
        shape: 'box',
        // size: 20,
        font: {
          size: 12,
          color: '#000'
        },
        // borderWidth: 4
      },
      edges: {
        width: 4
      },
      interaction: {
        hover: true
      },
      physics: {
        forceAtlas2Based: {
          springLength: 200
        },
        minVelocity: 0.75,
        solver: 'forceAtlas2Based'
      }
    };

    this.network = new Network(this.networkContainer.nativeElement, data, options);

    this.network.on('doubleClick', ($event: any) => {
      let node = this.nodes.get($event.nodes[0]);

      if (!node) return;
      this.lookupItem(node);
    });

    this.network.on('click', ($event: any) => {
      // path selection
      if (this.pathSelection && $event.nodes.length > 0) {
        this.selectedNodes.add($event.nodes[0]);
        this.nodes.update({ id: $event.nodes[0], shapeProperties: { borderDashes: false } });

        return;
      }

      // collapse node
      if ($event.event.srcEvent.ctrlKey) {
        let collapseNodes = new Set<any>();
        this.links.forEach((link: any) => {
          if (link.from === $event.nodes[0]) collapseNodes.add(link.to);
        });

        collapseNodes.forEach((c: string) => {
          this.nodes.remove(c);
          this.events.remove(c);
        });

        return;
      }

      // remove node
      if ($event.event.srcEvent.altKey) {
        this.nodes.remove($event.nodes[0]);

        return;
      }

      // if we made it all the way down here that means we are selecting nodes
      if ($event.nodes.length > 0) {
        this.nodes.forEach((node: any) => {
          if (node.id === $event.nodes[0]) this.selectedNode = node;
        });
        // only highlight in timeline if we have a temporal attribute
        if (this.selectedNode.startDate) this.highlightInTimeline(this.selectedNode);
      } else {
        this.selectedNode = null;
      }
    });

    this.network.on('hoverEdge', ($event: any) => {
      // dont hover when ctrl or alt key pressed
      if ($event.event.ctrlKey || $event.event.ctrlKey) return;
      // dont hover if no edge, path selection or type selection are active
      if (!this.mouseOver || !$event.edge || this.pathSelection || this.typeSelected || this.pathSelected) return;
      let connectedIds = new Set<string>();

      this.links.forEach((link: any) => {
        if (link.id !== $event.edge) {
          this.links.update({ id: link.id, hidden: true });
        } else {
          connectedIds.add(link.from);
          connectedIds.add(link.to);
        }
      });

      this.nodes.forEach((node: any) => {
        if (!connectedIds.has(node.id)) {
          this.nodes.update({ id: node.id, hidden: true });
        }
      })

    });

    this.network.on('blurEdge', ($event: any) => {
      if (!$event.edge || this.pathSelection || this.typeSelected || this.pathSelected) return;
      this.nodes.forEach((node: any) => { this.nodes.update({ id: node.id, hidden: false }); });
      this.links.forEach((link: any) => { this.links.update({ id: link.id, hidden: false }); });
    });

    this.network.on('hoverNode', ($event: any) => {
      // dont hover when ctrl or alt key pressed
      if ($event.event.ctrlKey || $event.event.altKey) return;
      // dont hover if no node, path selection or type selection are active
      if (!this.mouseOver || !$event.node || this.pathSelection || this.typeSelected || this.pathSelected) return;
      let connectedIds = new Set<string>();
      this.links.forEach((link: any) => {
        if (link.from !== $event.node && link.to !== $event.node) {
          // we should only be looking at links ending in or starting from $event.node (object id)
          this.links.update({ id: link.id, hidden: true });
        } else {
          connectedIds.add(link.to);
          connectedIds.add(link.from);
        }
      });

      this.nodes.forEach((node: any) => {
        if (!connectedIds.has(node.id)) {
          this.nodes.update({ id: node.id, hidden: true });
        }
      });
    });

    this.network.on('blurNode', ($event: any) => {
      if (!$event.node || this.pathSelection || this.typeSelected || this.pathSelected) return;
      this.nodes.forEach((node: any) => { this.nodes.update({ id: node.id, hidden: false }); });
      this.links.forEach((link: any) => { this.links.update({ id: link.id, hidden: false }); });
    });

    this.networkInitialized = true;
  }

  getMinMaxDate(): void {
    // if no start date setup some defaults
    if(!this.events.min('start')) {
      this.startDate = moment('01/05/1918', 'DD/MM/YYYY').year();
      this.endDate = moment('31/12/2018', 'DD/MM/YYYY').year();
      return;
    };
    this.startDate = moment(this.events.min('start').start).year();
    this.endDate = moment(this.events.max('end').end).year();
  }

  initTimeline(): void {
    let options = {
      minHeight: '100%',
      maxHeight: '100%',
      stack: true,
      // snap: true
    };

    this.timeline = new Timeline(this.timelineContainer.nativeElement, this.events, options);

    this.timeline.on('click', ($event: any) => {
      if (!$event.item) return;

      let event: Event;
      this.events.forEach((e: any) => {
        if (e.id === $event.item) {
          event = e;
          return;
        }
      });

      this.highlightInNetwork(event);
    });

    this.timelineInitialized = true;
    this.getMinMaxDate();

    this.timeline.fit();
  }

  highlightInTimeline(node: any): void {
    // if(!node || node.objectType !== 'event' || node.objectId !== 'historicevent') return;
    if (!node) return;

    this.timeline.focus(node.objectId);
  }

  highlightInNetwork(node: any): void {
    if (!node) return;

    this.network.focus(node.id, { animation: { duration: 250, easingFunction: 'easeInOutCubic' } });
  }
}
