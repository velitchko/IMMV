import { Component, OnInit, Inject, AfterViewInit, PLATFORM_ID, ViewChild, ElementRef } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { FormControl } from '@angular/forms';
import { ColorService } from '../../services/color.service';
import { DatabaseService } from '../../services/db.service';
import { PersonOrganization } from '.././../models/person.organization';
import { Event } from '.././../models/event';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { DataSet, Network, Timeline } from 'vis';
import * as moment from 'moment';

@Component({
  selector: 'app-personorganization',
  templateUrl: './personorganization.component.html',
  styleUrls: [ './personorganization.component.scss' ]
})
export class PersonOrganizationComponent implements AfterViewInit {
  @ViewChild('network') networkContainer: ElementRef;
  @ViewChild('timeline') timelineContainer: ElementRef;

  items: Array<Event>;
  isBrowser: boolean;
  highlighted: boolean = false;
  
  eventCtrl = new FormControl();
  filteredEvents: Observable<Array<Event>>;

  startDate: any;
  endDate: any;

  nodes: DataSet;
  links: DataSet;
  events: DataSet;
  colors: Map<string, string>;
  legendColor: Array<any>;

  network: Network;
  timeline: Timeline;

  networkInitialized: boolean;
  timelineInitialized: boolean;

  constructor(private db: DatabaseService,
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

    this.items = new Array<Event>();
    this.networkInitialized = false;
    this.timelineInitialized = false;
    
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
  // TODO: set a boolean prohibiting the reseting on blurNode / blurEdge / hoverNode / hoverEdge?
  highlightNodeType($event: string): void {
    let type = $event.toLowerCase().replace(' ', '').trim();

    let connectedIds = new Set<string>();
    this.nodes.forEach((node: any) => {
      if(node.objectType !== type) {
        this.nodes.update({id: node.id, hidden: true});
      } else {
        connectedIds.add(node.id);
      }
    });
    // TODO: constraint on displayling links betweeen nodes should be relaxed
    // could find a path connecting the set of nodes above somehow and display that
    this.links.forEach((link: any) => {
      if(!connectedIds.has(link.from) && !connectedIds.has(link.to)) {
        this.links.update({id: link.id, hidden: true}); 
      }
    });
  }

  clearHighlightedNodeType(): void {
    this.nodes.forEach((node: any) => { this.nodes.update({id: node.id, hidden: false}); });
    this.links.forEach((link: any) => { this.links.update({id: link.id, hidden: false}); });
  }

  enablePathSelection(): void {}


  selectedItem(event: Event): void {
    // this.highlightConnections(event);   
    this.db.getAsEvent(event).then((success) => {
      if(!this.networkInitialized) {
        this.setupData(success);
        this.initNetwork();
        this.initTimeline();
      } else {
        this.updateData(success);
      }
    });
  }
  
  private filterEvents(value: string): Array<Event> {
    const filterValue = value.toLowerCase();
    return this.items.filter(event => event.name.toLowerCase().indexOf(filterValue) === 0);
  }

  setupData(data: any): void {
    // ALL NODES (everything related to the ego node)
    if(!this.checkIfNodeExists(data.objectId)) {
      let root = data;
      root['objectType'] = 'event';
      root['id'] = data.objectId;
      root['label'] = data.name;
      root['color'] = this.colors.get('event');
      root['hidden'] = false;
      this.nodes.add(root);

      this.events.add({
        start: root.startDate,
        end: root.endDate ? root.endDate : root.startDate,
        title: root.name,
        content: root.name,
        id: root.objectId,
        type:  this.getTimeType(root.startDate, root.endDate),
        className: 'event',
        style: `background-color: ${this.colors.get('event')}; border-radius: 20px;`
      });
    }
    for(let i = 0; i < data.events.length; i++) {
      let e = data.events[i];
        let node = e.event;
        node['objectType'] = 'event';
        node['id'] = e.event.objectId;
        node['label'] = e.event.name;
        node['color'] = this.colors.get('event');
        node['hidden'] = false;
        this.nodes.add(node);

        this.events.add({
          start: node.startDate,
          end: node.endDate ? node.endDate : node.startDate,
          title: node.name,
          content: node.name,
          id: node.objectId,
          type:  this.getTimeType(node.startDate, node.endDate),
          className: 'event',
          style: `background-color: ${this.colors.get('event')}; border-radius: 20px;`
        });
    }
    for(let i = 0; i < data.themes.length; i++) {
      let t = data.themes[i];
        let node = t.theme;
        node['objectType'] = 'theme';
        node['id'] = t.theme.objectId;
        node['label'] = t.theme.name;
        node['color'] = this.colors.get('theme');
        node['hidden'] = false;
        this.nodes.add(node);
    }
    for(let i = 0; i < data.locations.length; i++) {
      let l = data.locations[i];
        let node = l.location;
        node['objectType'] = 'location';
        node['id'] = l.location.objectId;
        node['label'] = l.location.name;
        node['color'] = this.colors.get('location');
        node['hidden'] = false;
        this.nodes.add(node);
    }
    for(let i = 0; i < data.historicEvents.length; i++) {
      let h = data.historicEvents[i];
        let node = h.historicEvent;
        node['objectType'] = 'historicevent';
        node['id'] = h.historicEvent.objectId;
        node['label'] = h.historicEvent.name;
        node['color'] = this.colors.get('historicevent');
        node['hidden'] = false;
        this.nodes.add(node);
          this.events.add({
            start: node.startDate,
            end: node.endDate ? node.endDate : node.startDate,
            title: node.name,
            id: node.objectId,
            content: node.name,
            type: 'background',
            style: `background-color: ${this.colors.get('historicevent')}0D;`
          });
    }
    for(let i = 0; i < data.peopleOrganizations.length; i++) {
      let p = data.peopleOrganizations[i];
      if(!this.checkIfNodeExists(p.personOrganization.objectId)) {
        let node = p.personOrganization;
        node['objectType'] = 'personorganization';
        node['id'] = p.personOrganization.objectId;
        node['label'] = p.personOrganization.name;
        node['color'] = this.colors.get('personorganization');
        node['hidden'] = false;
        this.nodes.add(node);
      }
    }

    for(let i = 0; i < data.sources.length; i++) {
      let s = data.sources[i];
        let node = s.source;
        node['objectType'] = 'source';
        node['id'] = s.source.objectId;
        node['label'] = s.source.name;
        node['color'] = this.colors.get('source');
        node['hidden'] = false;
        this.nodes.add(node);
    }


    // ALL LINKS
    data.events.forEach((e: any) => {
      if(!this.checkIfLinkExists(data.objectId, e.event.objectId)) {
        this.links.add({
          source: data,
          from: data.objectId,
          target: e.event,
          to: e.event.objectId,
          label: e.relationship,
          color: this.colors.get('event'),
          hidden: false,
          font: {
            align: 'middle'
          }
        });
      }
    });
    data.themes.forEach((t: any) => {
      if(!this.checkIfLinkExists(data.objectId, t.theme.objectId)) {
        this.links.add({
          source: data,
          from: data.objectId,
          target: t.theme,
          to: t.theme.objectId,
          label: t.relationship,
          color: this.colors.get('themes'),
          hidden: false,
          font: {
            align: 'middle'
          }
        });
      }
    });
    data.locations.forEach((e: any) => {
      if(!this.checkIfLinkExists(data.objectId, e.location.objectId)) {
        this.links.add({
          source: data,
          from: data.objectId,
          target: e.location,
          to: e.location.objectId,
          label: e.relationship,
          color: this.colors.get('locations'),
          hidden: false,
          font: {
            align: 'middle'
          }
        });
      }
    });
    data.historicEvents.forEach((h: any) => {
      if(!this.checkIfLinkExists(data.objectId, h.historicEvent.objectId)) {
        this.links.add({
          source: data,
          from: data.objectId,
          target: h.historicEvent,
          to: h.historicEvent.objectId,
          label: h.relationship,
          color: this.colors.get('historicevent'),
          hidden: false,
          font: {
            align: 'middle'
          }
        });
      }
    });
    data.peopleOrganizations.forEach((p: any) => {
      if(!this.checkIfLinkExists(data.objectId, p.personOrganization.objectId)) {
        this.links.add({
          source: data,
          from: data.objectId,
          target: p.personOrganization,
          to: p.personOrganization.objectId,
          label: p.relationship,
          color: this.colors.get('personorganization'),
          hidden: false,
          font: {
            align: 'middle'
          }
        });
      }
    });
    data.sources.forEach((s: any) => {
      if(!this.checkIfLinkExists(data.objectId, s.source.objectId)) {
        this.links.add({
          source: data,
          from: data.objectId,
          target: s.source,
          to: s.source.objectId,
          label: s.relationship,
          color: this.colors.get('source'),
          hidden: false,
          font: {
            align: 'middle'
          }
        });
      }
    });
  }

  checkIfNodeExists(objectId: string): boolean {
    // return this.nodes.get(objectId) !== null;

    let nodeExists = false;

    this.nodes.forEach((n: any) => {
      if(n.objectId === objectId) {
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
      if(from === l.from && to === l.to || 
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
  }

  updateData(data: any): void {
    if(!this.checkIfNodeExists(data.objectId)) {
      let root = data;
      root['objectType'] = 'event';
      root['id'] = root.objectId;
      root['label'] = data.name;
      root['color'] = this.colors.get('event');
      root['shape'] = 'box';
      root['hidden'] = false;
      this.nodes.add(root);

      this.events.add({
        start: root.startDate,
        end: root.endDate ? root.endDate : root.startDate,
        title: root.name,
        id: root.objectId,
        content: root.name,
        type:  this.getTimeType(root.startDate, root.endDate),
        className: 'event',
        style: `background-color: ${this.colors.get('event')}; border-radius: 20px;`
      });
    }
    
    if(data.events) {  
      for(let i = 0; i < data.events.length; i++) {
        let e = data.events[i];
        // NODES
        if(!this.checkIfNodeExists(e.event.objectId)) {
          let node = e.event;
          node['objectType'] = 'event';
          node['id'] = e.event.objectId;
          node['label'] = e.event.name;
          node['color'] = this.colors.get('event');
          node['hidden'] = false;
          this.nodes.add(node);

          this.events.add({
            start: node.startDate,
            end: node.endDate ? node.endDate : node.startDate,
            title: node.name,
            id: node.objectId,
            content: node.name,
            type:  this.getTimeType(node.startDate, node.endDate),
            className: 'event',
            style: `background-color: ${this.colors.get('event')}; border-radius: 20px;`
          });
          // if node doesnt exist the link doesnt as well
          if(this.checkIfLinkExists(data.objectId, e.event.objectId)) continue;
          this.links.add({
            source: data,
            from: data.objectId,
            target: e.event,
            to: e.event.objectId,
            label: e.relationship,
            color: this.colors.get('event'),
            hidden: false,
            font: {
              align: 'middle'
            }
          });
        } else {
          if(this.checkIfLinkExists(data.objectId, e.event.objectId)) continue;
          this.links.add({
            source: data,
            from: data.objectId,
            target: e.event,
            to: e.event.objectId,
            label: e.relationship,
            color: this.colors.get('event'),
            hidden: false,
            font: {
              align: 'middle'
            }
          });
        }
      }
    }
    if(data.locations) {
      for(let i = 0; i < data.locations.length; i++) {
        let e = data.locations[i];
        // NODES
        if(!this.checkIfNodeExists(e.location.objectId)) {
          let node = e.location;
          node['objectType'] = 'location';
          node['id'] = e.location.objectId;
          node['label'] = e.location.name;
          node['color'] = this.colors.get('location');
          node['hidden'] = false;
          this.nodes.add(node);
          if(this.checkIfLinkExists(data.objectId, e.location.objectId)) continue;
          this.links.add({
            source: data,
            from: data.objectId,
            target: e.location,
            to: e.location.objectId,
            label: e.relationship,
            color: this.colors.get('location'),
            hidden: false,
            font: {
              align: 'middle'
            }
          });
        } else {
          if(this.checkIfLinkExists(data.objectId, e.location.objectId)) continue;
          this.links.add({
            source: data,
            from: data.objectId,
            target: e.location,
            to: e.location.objectId,
            label: e.relationship,
            color: this.colors.get('location'),
            hidden: false,
            font: {
              align: 'middle'
            }
          });
        } 
      }
    }

    if(data.peopleOrganizations) {
      for(let i = 0; i < data.peopleOrganizations.length; i++) {
        let e = data.peopleOrganizations[i];
        // NODES
        if(!this.checkIfNodeExists(e.personOrganization.objectId)) {
          let node = e.personOrganization;
          node['objectType'] = 'personorganization';
          node['id'] = e.personOrganization.objectId;
          node['label'] = e.personOrganization.name;
          node['color'] = this.colors.get('personorganization');
          node['hidden'] = false;
          this.nodes.add(node);
          if(this.checkIfLinkExists(data.objectId, e.personOrganization.objectId)) continue;
          this.links.add({
            source: data,
            from: data.objectId,
            target: e.personOrganization,
            to: e.personOrganization.objectId,
            label: e.relationship,
            color: this.colors.get('personorganization'),
            hidden: false,
            font: {
              align: 'middle'
            }
          });
        } else {
          if(this.checkIfLinkExists(data.objectId, e.personOrganization.objectId)) continue;
          this.links.add({
            source: data,
            from: data.objectId,
            target: e.personOrganization,
            to: e.personOrganization.objectId,
            label: e.relationship,
            color: this.colors.get('personorganization'),
            hidden: false,
            font: {
              align: 'middle'
            }
          });
        }
      }
    }

    if(data.sources) {
      for(let i = 0; i < data.sources.length; i++) {
        let e = data.sources[i];
        // NODES
        if(!this.checkIfNodeExists(e.source.objectId)) {
          let node = e.source;
          node['objectType'] = 'source';
          node['id'] = e.source.objectId;
          node['label'] = e.source.name;
          node['color'] = this.colors.get('source');
          node['hidden'] = false;
          this.nodes.add(node);
          if(this.checkIfLinkExists(data.objectId, e.source.objectId)) continue;
          this.links.add({
            source: data,
            from: data.objectId,
            target: e.source,
            to: e.source.objectId,
            label: e.relationship,
            color: this.colors.get('source'),
            hidden: false,
            font: {
              align: 'middle'
            }
          });
        } else {
          if(this.checkIfLinkExists(data.objectId, e.source.objectId)) continue;
          this.links.add({
            source: data,
            from: data.objectId,
            target: e.source,
            to: e.source.objectId,
            label: e.relationship,
            color: this.colors.get('source'),
            hidden: false,
            font: {
              align: 'middle'
            }
          });
        }
      }
    }

    if(data.themes) {
      for(let i = 0; i < data.themes.length; i++) {
        let e = data.themes[i];
        // NODES
        if(!this.checkIfNodeExists(e.theme.objectId)) {
          let node = e.theme;
          node['objectType'] = 'theme';
          node['id'] = e.theme.objectId;
          node['label'] = e.theme.name;
          node['color'] = this.colors.get('theme');
          node['hidden'] = false;
          this.nodes.add(node);
          if(this.checkIfLinkExists(data.objectId, e.theme.objectId)) continue;
          this.links.add({
            source: data,
            from: data.objectId,
            target: e.theme,
            to: e.theme.objectId,
            label: e.relationship,
            color: this.colors.get('theme'),
            hidden: false,
            font: {
              align: 'middle'
            }
          });
        } else {
          if(this.checkIfLinkExists(data.objectId, e.theme.objectId)) continue;
          this.links.add({
            source: data,
            from: data.objectId,
            target: e.theme,
            to: e.theme.objectId,
            label: e.relationship,
            color: this.colors.get('theme'),
            hidden: false,
            font: {
              align: 'middle'
            }
          });
        }
      }
    }

    if(data.historicEvents) {
      for(let i = 0; i < data.historicEvents.length; i++) {
        let e = data.historicEvents[i];
        // NODES
        if(!this.checkIfNodeExists(e.historicEvent.objectId)) {
          let node = e.historicEvent;
          node['objectType'] = 'historicevent';
          node['id'] = e.historicEvent.objectId;
          node['label'] = e.historicEvent.name;
          node['color'] = this.colors.get('historicevent');
          node['hidden'] = false;
          this.nodes.add(node);
            this.events.add({
              start: node.startDate,
              end: node.endDate ? node.endDate : node.startDate,
              title: node.name,
              id: node.objectId,
              content: node.name,
              type: 'background',
              style: `background-color: ${this.colors.get('historicevent')}0D;`
            });
          if(this.checkIfLinkExists(data.objectId, e.historicEvent.objectId)) continue;
          this.links.add({
            source: data,
            from: data.objectId,
            target: e.historicEvent,
            to: e.historicEvent.objectId,
            label: e.relationship,
            color: this.colors.get('historicevent'),
            hidden: false,
            font: {
              align: 'middle'
            }
          });
        } else {
          if(this.checkIfLinkExists(data.objectId, e.historicEvent.objectId)) continue;
          this.links.add({
            source: data,
            from: data.objectId,
            target: e.historicEvent,
            to: e.historicEvent.objectId,
            label: e.relationship,
            color: this.colors.get('historicevent'),
            hidden: false,
            font: {
              align: 'middle'
            }
          });
        }
      }
    }

    
    this.timeline.focus(this.events.map((e: any) => { return e.id; }), { animation: { duration: 250, easingFunction: 'easeInOutCubic' } });
    let interval = this.timeline.getWindow();
    this.startDate = moment(interval.start).year();
    this.endDate = moment(interval.end).year();
  }

  lookupItem(item: any): void {
    switch(item.objectType) {
      case 'event':
        this.db.getAsEvent(item).then((success) => {
          this.updateData(success);
        });
        return;
      case 'historicevent':
        this.db.getAsHistoricEvent(item).then((success) => {
          this.updateData(success);
        });
        return;
      case 'location':
        this.db.getAsLocation(item).then((success) => {
          this.updateData(success);
        });
        return;
      case 'theme':
        this.db.getAsTheme(item).then((success) => {
          this.updateData(success);
        });
        return;
      case 'source':
        this.db.getAsSource(item).then((success) => {
          this.updateData(success);
        });
        return;
      case 'personorganization':
        this.db.getAsPersonOrganization(item).then((success) => {
          this.updateData(success);
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

    // TODO: Semtnatic path finding implementation (should be switch to enable/disable selection)
    this.network.on('doubleClick', ($event: any) => {
      let nodeId = $event.nodes[0];
      let node = this.nodes.get(nodeId);
      if(!node) return;
      this.lookupItem(node);
    });

    // TODO: implement click handler to popup side panel with detail info
    // TODO: also implement side panel 
    this.network.on('click', ($event: any) => {
      console.log('click');
      console.log($event);
      if($event.event.srcEvent.ctrlKey) { console.log('ctrl key pressed on click '); }
      if($event.event.srcEvent.altKey)  { console.log('alt key pressed on click '); }
    });

    this.network.on('hoverEdge', ($event: any) => {
      if(!$event.edge) return;
      let connectedIds = new Set<string>();
      
      this.links.forEach((link: any) => { 
        if(link.id !== $event.edge) {
          this.links.update({ id: link.id, hidden: true });
        } else {
          connectedIds.add(link.from);
          connectedIds.add(link.to);
        }
      });

      this.nodes.forEach((node: any) => {
        if(!connectedIds.has(node.id)) {
          this.nodes.update({id: node.id, hidden: true});
        }
      })

    });

    this.network.on('blurEdge', ($event: any) => {
      this.nodes.forEach((node: any) => { this.nodes.update({id: node.id, hidden: false }); });
      this.links.forEach((link: any) => { this.links.update({id: link.id, hidden: false }); });
    });

    this.network.on('hoverNode', ($event: any) => {
      if(!$event.node) return;
      let connectedIds = new Set<string>();
      this.links.forEach((link: any) => {
        if(link.from !== $event.node && link.to !== $event.node) {
          // we should only be looking at links ending in or starting from $event.node (object id)
          this.links.update({ id: link.id, hidden: true });
        } else {
          connectedIds.add(link.to);
          connectedIds.add(link.from);
        }
      });

      this.nodes.forEach((node: any) => {
        if(!connectedIds.has(node.id)) {
          this.nodes.update({id: node.id, hidden: true });
        }
      });
    });

    this.network.on('blurNode', ($event: any) => {
      this.nodes.forEach((node: any) => { this.nodes.update({id: node.id, hidden: false}); });
      this.links.forEach((link: any) => { this.links.update({id: link.id, hidden: false}); });
    });

    this.networkInitialized = true;
  }

  initTimeline(): void {
    let options = {
      minHeight: '100%'
    };
    this.timeline = new Timeline(this.timelineContainer.nativeElement, this.events, options);
    this.timeline.on('click', ($event: any) => { 
      if(!$event.item) return;

      let event: Event;
      this.events.forEach((e: any) => {
        if(e.id === $event.item) {
          event = e;
          return;
        }
      });

      this.highlightInNetwork(event);
    });

    this.timelineInitialized = true;

    let interval = this.timeline.getWindow();
    this.startDate = moment(interval.start).year();
    this.endDate = moment(interval.end).year();
    
    this.timeline.fit();
  }

  highlightInTimeline(node: any): void {
    // if(!node || node.objectType !== 'event' || node.objectId !== 'historicevent') return;
    if(!node) return;
    
    this.timeline.focus(node.objectId);
    console.log('[TL] highlighting node');
    console.log(node);
  }

  highlightInNetwork(node: any): void {
    if(!node) return;

    this.network.focus(node.id, { animation: { duration: 250, easingFunction: 'easeInOutCubic' }});
    console.log('[N] highlighting node');
    console.log(node);
  }
}
