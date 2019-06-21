import { Component, OnInit, Inject, AfterViewInit, PLATFORM_ID, ViewChild, ElementRef } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { MatSnackBar } from '@angular/material';
import { FormControl } from '@angular/forms';
import { ColorService } from '../../services/color.service';
import { DatabaseService } from '../../services/db.service';
import { PersonOrganization } from '.././../models/person.organization';
import { Event } from '.././../models/event';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { DataSet, Network, Timeline } from 'vis';
import * as moment from 'moment';
import * as momentIterator from 'moment-iterator';

@Component({
  selector: 'app-personorganization',
  templateUrl: './personorganization.component.html',
  styleUrls: ['./personorganization.component.scss']
})
export class PersonOrganizationComponent implements AfterViewInit {
  @ViewChild('network') networkContainer: ElementRef;
  @ViewChild('timeline') timelineContainer: ElementRef;

  items: Array<Event>; // array to hold results from autocomplete

  isBrowser: boolean;
  pathSelection: boolean = false; // path selection mode
  typeSelected: boolean = false; // node type selection
  pathSelected: boolean = false; // when a path has been selected
  mouseOver: boolean = false;

  eventCtrl = new FormControl();
  filteredEvents: Observable<Array<Event>>;
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

  constructor(private db: DatabaseService,
    private snackBar: MatSnackBar,
    @Inject(PLATFORM_ID) private _platformId: Object) {

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

    this.items = new Array<Event>();
    this.selectedNodes = new Set<any>();

    this.networkInitialized = false;
    this.timelineInitialized = false;
    this.pathSelection = false;
    this.pathSelected = false;
    this.typeSelected = false;
    this.mouseOver = false;

    this.selectedNode = null;
    this.filteredEvents = this.eventCtrl.valueChanges
      .pipe(
        startWith(''),
        map(event => event ? this.filterEvents(event) : this.items.slice())
      );
  }

  ngAfterViewInit(): void {
    this.db.getAllEvents().then((success) => {
      this.items = success;

    });
  }

  getCountPerYear(startDate: Date, endDate: Date): Map<string, number> {
    let countPerYear = new Map<string, number>();

    // initiates map with each year and a count of 1
    momentIterator(moment(startDate), moment(endDate)).each('year', (d: any) => {
        countPerYear.set(d.year().toString(), 0);
    });

    return countPerYear;
  }

  populateCountByTypeAndYear(): void {
    this.countByTypeAndYear = new Map<string, Map<string, number>>();
    let minDate = moment(this.nodes.min('startDate').startDate);
    let maxDate = moment(this.nodes.max('endDate') ? this.nodes.max('endDate').endDate : this.nodes.max('startDate').startDate);

    let map = this.getCountPerYear(minDate.toDate(), maxDate.toDate());
    this.nodes.forEach((node: any) => {
      if(node.objectType.includes('event')) {
        if(this.countByTypeAndYear.has(node.objectType)) {
          let exists = this.countByTypeAndYear.get(node.objectType);
          exists.forEach((value: number, key: string) => {
            // inBetween(start, end, granularity, inclusion)
            if(moment.utc(key).isBetween(moment(node.startDate), moment(node.endDate), 'years', '[]')) {
              // inc value  
              exists.set(key, exists.get(key) + 1);
            }
          });
        } else {
          // for ever new node type we should create a copy of the map
          let newMap = new Map<string, number>(map);
          newMap.forEach((value: number, key: string) => {
            if(moment.utc(key).isBetween(moment(node.startDate), moment(node.endDate), 'years', '[]')) {
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
  
  selectedItem(event: Event): void {
    this.db.getAsEvent(event).then((success) => {
      if (!this.networkInitialized) {
        this.setupData(success);
        this.initNetwork();
        this.initTimeline();
        this.populateCountByTypeAndYear();
      } else {
        this.updateData(success);
        this.populateCountByTypeAndYear();
      }
    });
  }

  private openSnackBar(message: string) {
    this.snackBar.open(message, 'close', {
      duration: 750,
    });
  }

  private filterEvents(value: string): Array<Event> {
    const filterValue = value.toLowerCase();
    return this.items.filter(event => event.name.toLowerCase().indexOf(filterValue) === 0);
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

  setupData(data: any): void {
    // ALL NODES (everything related to the ego node)
    if (!this.checkIfNodeExists(data.objectId)) {
      let root = data;
      root['objectType'] = 'event';
      root['id'] = data.objectId;
      root['label'] = `${data.name} ${this.getTotalRelationshipCount(data) ? `(${this.getTotalRelationshipCount(data)})` : ''}`;
      root['color'] = this.colors.get('event');
      root['hidden'] = false;
      this.nodes.add(root);

      if(!this.checkIfEventExists(root.objectId) && root.startDate) {
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

    for (let i = 0; i < data.events.length; i++) {
      let e = data.events[i];
      this.addDataItems(data, e, 'event');
    }

    for (let i = 0; i < data.themes.length; i++) {
      let e = data.themes[i];
      this.addDataItems(data, e, 'theme');
    }
    for (let i = 0; i < data.locations.length; i++) {
      let e = data.locations[i];
      this.addDataItems(data, e, 'location')
    }
    for (let i = 0; i < data.historicEvents.length; i++) {
      let e = data.historicEvents[i];
      this.addDataItems(data, e, 'historicEvent');
    }
    for (let i = 0; i < data.peopleOrganizations.length; i++) {
      let e = data.peopleOrganizations[i];
      this.addDataItems(data, e, 'personOrganization')
    }

    for (let i = 0; i < data.sources.length; i++) {
      let e = data.sources[i];
      this.addDataItems(data, e, 'source');
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
    this.eventCtrl.setValue('');

    this.pathSelection = false;
    this.typeSelected = false;

    this.selectedNodes = new Set<any>();
  }

  updateData(data: any): void {
    if (!this.checkIfNodeExists(data.objectId)) {
      let root = data;
      root['objectType'] = 'event';
      root['id'] = root.objectId;
      root['label'] = `${root.name} ${this.getTotalRelationshipCount(root) ? `(${this.getTotalRelationshipCount(root)})` : ''})`;
      root['color'] = this.colors.get('event');
      root['shape'] = 'box';
      root['hidden'] = false;
      this.nodes.add(root);
      if(!this.checkIfEventExists(root.objectId) && root.startDate) {
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

    if (data.events) {
      for (let i = 0; i < data.events.length; i++) {
        let e = data.events[i];
        this.addDataItems(data, e, 'event');
      }
    }
    if (data.locations) {
      for (let i = 0; i < data.locations.length; i++) {
        let e = data.locations[i];
        this.addDataItems(data, e, 'location');
      }
    }

    if (data.peopleOrganizations) {
      for (let i = 0; i < data.peopleOrganizations.length; i++) {
        let e = data.peopleOrganizations[i];
        this.addDataItems(data, e, 'personOrganization');
      }
    }

    if (data.sources) {
      for (let i = 0; i < data.sources.length; i++) {
        let e = data.sources[i];
        this.addDataItems(data, e, 'source');
      }
    }

    if (data.themes) {
      for (let i = 0; i < data.themes.length; i++) {
        let e = data.themes[i];
        this.addDataItems(data, e, 'theme');
      }
    }

    if (data.historicEvents) {
      for (let i = 0; i < data.historicEvents.length; i++) {
        let e = data.historicEvents[i];
        this.addDataItems(data, e, 'historicEvent');
      }
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
      if(!this.checkIfEventExists(root.objectId) && root.startDate) {
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

    if(this.checkIfLinkExists(parent.objectId, event.objectId)) {
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
          style: (node.objectType === 'event')  ? `background-color: ${this.colors.get(type.toLowerCase())}; border-radius: 20px;` :  `background-color: ${this.colors.get(type.toLowerCase())}0D;`
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
