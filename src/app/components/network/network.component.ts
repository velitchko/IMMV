import { Component, OnInit, Inject, AfterViewInit, PLATFORM_ID, ViewChild, ElementRef } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormControl } from '@angular/forms';
import { DatabaseService } from '../../services/db.service';
import { ThemeService } from '../../services/theme.service';
import { PersonOrganization } from '../../models/person.organization';
import { Location } from '../../models/location';
import { Event } from '../../models/event';
import { HistoricEvent } from '../../models/historic.event';
import { Source } from '../../models/source';
import { Theme } from '../../models/theme';
import { Observable } from 'rxjs';
import { switchMap, startWith, debounceTime, tap, finalize } from 'rxjs/operators';
import { from } from 'rxjs';
import { Network, Timeline, DataSet } from 'vis';
import * as moment from 'moment';
import * as momentIterator from 'moment-iterator';
import { MatSidenav } from '@angular/material/sidenav';
import { MusicMapService } from 'src/app/services/musicmap.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-network',
  templateUrl: './network.component.html',
  styleUrls: ['./network.component.scss']
})
export class NetworkComponent implements AfterViewInit {
  @ViewChild('network', { static: true }) networkContainer: ElementRef;
  @ViewChild('timeline', { static: true }) timelineContainer: ElementRef;
  @ViewChild('previewdrawer', { static: false }) previewdrawer: MatSidenav;

  // URL parameters
  themeID: string;
  
  items: Array<Event & HistoricEvent & Location & PersonOrganization & Source & Theme>; // array to hold results from autocomplete

  isBrowser: boolean;
  loading: boolean;
  pathSelection: boolean = false; // path selection mode
  typeSelected: boolean = false; // node type selection
  pathSelected: boolean = false; // when a path has been selected
  mouseOver: boolean = false;

  searchCtrl = new FormControl();
  filteredItems: Observable<any>;
  selectedNode: any;
  selectedNodeType: string;
  objectToBeDisplayed: any | (Event & PersonOrganization & Location & Theme & Source & HistoricEvent);

  startDate: any;
  endDate: any;

  nodes: DataSet<any>;
  links: DataSet<any>;
  events: DataSet<any>;
  legend: Array<any>;
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
              @Inject(PLATFORM_ID) private _platformId: Object, 
              private route: ActivatedRoute,
              private mms: MusicMapService,
              private ts: ThemeService) {
    this.selectedNodeType = '';

    this.themeID = this.route.snapshot.queryParamMap.get('themeID');

    this.isBrowser = isPlatformBrowser(this._platformId);
    
    this.loading = false;

    this.legend = new Array<any>();

    this.legend.push({ display: 'Event', icon: 'event' });
    this.legend.push({ display: 'Person/Organization', icon: 'account_circle' });
    this.legend.push({ display: 'Location', icon: 'place' });
    this.legend.push({ display: 'Theme', icon: 'donut_large' });
    this.legend.push({ display: 'Source', icon: 'collections' });
    this.legend.push({ display: 'Historic Event', icon: 'history' });

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

  ngAfterViewInit(): void { 
    this.mms.currentlySelectedEvent.subscribe((event: string) => {
      if(!event || !this.previewdrawer) return;
      let found = this.db.getEventById(event);
      if(found) {
        this.db.getAsEvent(found).then((success: Event) => {
          this.objectToBeDisplayed = success;
          this.previewdrawer.toggle();
        });
      } else {
        this.db.getEvent(event).then((success: Event) => {
          this.objectToBeDisplayed = success;
          this.previewdrawer.toggle();
        });
      }
    });
    
    if(this.themeID) {
      this.db.getTheme(this.themeID).then((success: any) => {
        let theme = success;
        this.update(theme);
      });
    }

  }

  getCountPerYear(startDate: Date, endDate: Date): Map<string, number> {
    let countPerYear = new Map<string, number>();

    // initiates map with each year and a count of 1
    momentIterator(moment(startDate), moment(endDate)).each('year', (d: any) => {
      countPerYear.set(d.year().toString(), 0);
    });

    return countPerYear;
  }

  highlightNodeType($event: string): void {
    this.selectedNodeType = $event;

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

  selectedItem(item: Event & PersonOrganization & Location & Theme & Source & HistoricEvent): void {
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

  closePreviewDrawer(): void {
    this.objectToBeDisplayed = null;
    this.mms.setSelectedEvent(null);
    this.previewdrawer.toggle();
  }

  update(data: any): void {
    if(!this.isBrowser) return;
    if (!this.networkInitialized) {
      this.setupData(data);
      this.initNetwork();
      this.initTimeline();
    } else {
      this.updateData(data);
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

  getTotalRelationshipCount(object: Event | PersonOrganization | Location | HistoricEvent | Source | Theme): Promise<any> {
    return this.db.getRelationshipCount(object.objectId, object.objectType);
  }

  checkIfEventExists(id: string): boolean {
    return this.events.get(id);
  }

  // TODO: Icons for the nodes -> Requires the node type to be set to icon
  // TODO: Can also embed images in nodes -> https://almende.github.io/vis/docs/network/nodes.html

  async setupData(data: Event & PersonOrganization & Location & HistoricEvent & Source & Theme): Promise<any> {
    // ALL NODES (everything related to the ego node)
    if (!this.checkIfNodeExists(data.objectId)) {
      let root = data;
      root['objectType'] = data.objectType.toLowerCase();
      root['id'] = data.objectId;
      let count = await this.getTotalRelationshipCount(data);
      root['label'] = `${data.name} (${count})`;
      root['color'] = this.ts.getThemeColorForEvent(data); //this.colors.get(data.objectType.toLowerCase());
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
          style: `background-color: ${root['color']}; border-radius: 20px;`
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

  async updateData(data: Event & PersonOrganization & Location & HistoricEvent & Source & Theme): Promise<any> {
    if(!data) return;

    if (!this.checkIfNodeExists(data.objectId)) {
      let root = data;
      root['objectType'] = data.objectType.toLowerCase();
      root['id'] = root.objectId;
      let count = await this.getTotalRelationshipCount(root);
      root['label'] = `<mat-icon>event</mat-icon>${root.name} ${count})`;
      root['color'] =  this.ts.getThemeColorForEvent(data); //this.colors.get('event');
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
          style: `background-color: ${root['color']}; border-radius: 20px;`
        });
      }
    }

     // Build data conditionally
      if (data.objectType.toLowerCase() === 'event') {
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

    if (data.objectType.toLowerCase() === 'person') {
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

    if (data.objectType.toLowerCase() === 'location') {
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

    if(data.objectType.toLowerCase() === 'source') {
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

    if(data.objectType.toLowerCase() === 'historicevent') {
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

    if(data.objectType.toLowerCase() === 'theme') {
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

  async addEvent(event: Event, parent: any): Promise<any> {
    if (!this.checkIfNodeExists(event.objectId)) {
      let root = event;
      root['objectType'] = 'event';
      root['id'] = root.objectId;
      let count = await this.getTotalRelationshipCount(root);
      root['label'] = `${root.name} (${count})`;
      root['color'] = this.ts.getThemeColorForEvent(event);
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
          style: `background-color: ${root['color']}; border-radius: 20px;`
        });
      }
    }

    if (this.checkIfLinkExists(parent.objectId, event.objectId)) {
      return;
    }

    let label = event.themes.find((e: any) => {
      return e.theme === parent.objectId;
    });

    this.links.add({
      source: parent,
      from: parent.objectId,
      target: event,
      to: event.objectId,
      label: label ? label.relationship : '',
      color: '#e7e7e7', // TODO: Link color by something?
      hidden: false,
      font: {
        align: 'middle'
      }
    });
  }

  deselect(): void {
    this.selectedNodeType = '';
    this.clearHighlightedNodesLinks();
  }

  async addDataItems(parent: any, data: any, type: string): Promise<any> {
      // create node and add to nodes
      let node = data[type];
      node['objectType'] = type.toLowerCase();
      node['id'] = data[type].objectId;
      let count = await this.getTotalRelationshipCount(data[type]);
      node['label'] = `${data[type].name} (${count})`;
      node['color'] = type.toLowerCase() === 'event' ? this.ts.getThemeColorForEvent(data[type]) : '#e7e7e7'; //this.colors.get(type.toLowerCase());
      node['hidden'] = false;
      this.nodes.update(node);

      // create event from node and add to events (TL)
      if ((node.objectType === 'event' || node.objectType === 'historicevent') && node.startDate) {
        this.events.update({
          start: node.startDate,
          end: node.endDate ? node.endDate : node.startDate,
          title: node.name,
          id: node.objectId,
          content: node.name,
          type: (node.objectType === 'event') ? 'point' : 'background',
          style: (node.objectType === 'event') ? `background-color: ${node['color']}; border-radius: 20px;` : `background-color: ${node['color']}0D;`
        });
        // update everytime we get a new event
        if(this.timeline) this.timeline.fit();
        // update min max dates
        this.getMinMaxDate();
      }

      // create links for node and add to links
      this.links.update({
        source: data,
        from: parent.objectId,
        target: data[type],
        to: data[type].objectId,
        label: data.relationship,
        color: '#e7e7e7e', // TODO: Link color?
        hidden: false,
        font: {
          align: 'middle'
        }
      });
  }

  lookupItem(item: any): void {
    switch (item.objectType) {
      case 'event':
        this.db.getAsEvent(item).then((success: any) => {
          this.updateData(success);
        });
        this.db.getEventsByEvent(item).then((success: Array<Event>) => {
          success.forEach((s: Event) => { this.addEvent(s, item); });
        })
        return;
      case 'historicevent':
        this.db.getAsHistoricEvent(item).then((success: any) => {
          this.updateData(success);
        });
        this.db.getEventsByHistoricEvent(item).then((success: Array<Event>) => {
          success.forEach((s: Event) => { this.addEvent(s, item); });
        });
        return;
      case 'location':
        this.db.getAsLocation(item).then((success: any) => {
          this.updateData(success);
        });
        this.db.getEventsByLocation(item).then((success: Array<Event>) => {
          success.forEach((s: Event) => { this.addEvent(s, item); });
        });
        return;
      case 'theme':
        this.db.getAsTheme(item).then((success: any) => {
          this.updateData(success);
        });
        this.db.getEventsByTheme(item).then((success: Array<Event>) => {
          success.forEach((s: Event) => { this.addEvent(s, item); });
        });
        return;
      case 'source':
        this.db.getAsSource(item).then((success: any) => {
          this.updateData(success);
        });
        this.db.getEventsBySource(item).then((success: Array<Event>) => {
          success.forEach((s: Event) => { this.addEvent(s, item); });
        });
        return;
      case 'person':
      case 'organization': 
      case 'personorganization':
        this.db.getAsPersonOrganization(item).then((success: any) => {
          this.updateData(success);
        });
        this.db.getEventsByPersonOrganization(item).then((success: Array<Event>) => {
          success.forEach((s: Event) => { this.addEvent(s, item); });
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
        shapeProperties: {
          interpolation: false
        }
        // borderWidth: 4
      },
      edges: {
        width: 4,
        smooth: {
          enabled: true,
          roundness: .7,
          type: 'continuous'
        }
      },
      interaction: {
        hover: true
      },
      layout : {
        improvedLayout: false,
        randomSeed: 191006
      },
      physics: {
        stabilization: {
          iterations: 987,
          updateInterval: 100
      },
        // forceAtlas2Based: {
        //   springLength: 200
        // },
        // minVelocity: 0.75,
        // solver: 'forceAtlas2Based'
        solver: 'barnesHut',
        barnesHut: {
        //     gravitationalConstant: -10000,
            springConstant: 0.04,
        // //     // centralGravity: 0,
            springLength: 200,
            damping: 0.5,
            avoidOverlap: .5,
        },
      }
    };

    this.network = new Network(this.networkContainer.nativeElement, data, options);

    this.network.on('doubleClick', ($event: any) => {
      let node = this.nodes.get($event.nodes[0]);
      if (!node) return;
      this.lookupItem(node);
    });

    this.network.on('click', ($event: any) => {
      let node: any = this.nodes.get($event.nodes[0]);
      
      if(!node) return;
      console.log(node);
      // TODO: Setup service to work with other object types
      // look up the node details (db.services)
      if(node.objectType === 'event') this.mms.setSelectedEvent(node.objectId);
      
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
    if(!this.timeline) return;
    let minMax = this.timeline.getItemRange();
    this.startDate = moment(minMax.min).year();
    this.endDate = moment(minMax.max).year();
  }

  initTimeline(): void {
    let options = {
      minHeight: '100%',
      maxHeight: '100%',
      stack: true,
      start: moment('01/05/1918', 'DD/MM/YYYY').toDate(),
      end: moment('31/12/2018', 'DD/MM/YYYY').toDate()
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
      this.mms.setSelectedEvent($event.item);
    });

    this.timelineInitialized = true;
    this.getMinMaxDate();

    this.timeline.fit();
  }

  highlightInTimeline(node: any): void {
    // if(!node || node.objectType !== 'event' || node.objectId !== 'historicevent') return;
    if (!node) return;
    // TODO: Consider graying out / lowering opacity of nodes not matching request
    this.timeline.focus(node.objectId);
  }

  highlightInNetwork(node: any): void {
    if (!node) return;
    // TODO: Consider graying out / lowering opacity of nodes not matching request
    this.network.focus(node.id, { animation: { duration: 250, easingFunction: 'easeInOutCubic' } });
  }
}
