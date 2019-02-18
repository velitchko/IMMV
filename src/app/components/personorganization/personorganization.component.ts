import { Component, OnInit, Inject, AfterViewInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { FormControl } from '@angular/forms';
import { ColorService } from '../../services/color.service';
import { DatabaseService } from '../../services/db.service';
import { PersonOrganization } from '.././../models/person.organization';
import { Event } from '.././../models/event';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import * as d3 from 'd3';
import { SimulationNodeDatum, SimulationLinkDatum } from 'd3';
import { link } from 'fs';
// import { interpolate } from 'flubber';
@Component({
  selector: 'app-personorganization',
  templateUrl: './personorganization.component.html',
  styleUrls: [ './personorganization.component.scss' ]
})
export class PersonOrganizationComponent implements AfterViewInit {
  items: Array<Event>;
  isBrowser: boolean;
  highlighted: boolean = false;
  eventCtrl = new FormControl();
  filteredEvents: Observable<Array<Event>>;

  // d3 things
  force: any;
  svg: any;
  nodes: Array<any>;
  nodeSVG: any;
  links: Array<any>;
  linkSVG: any;
  labelSVG: any;
  nodeLabelSVG: any;
  tooltip: any;
  line: any;
  g: any;
  zoom: any;

  colors: Map<string, string>;

  // Size setup
  private SVG_WIDTH: number = 1850;
  private SVG_HEIGHT: number = 860;
  private GLYPH_WIDTH: number = 10;
  private GLYPH_HEIGHT: number = 10;
  private LINK_DISTANCE: number = 500;

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

    this.nodes = new Array<SimulationNodeDatum>();
    this.links = new Array<SimulationLinkDatum<SimulationNodeDatum>>();
    this.items = new Array<Event>();

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
  
  selectedItem(event: Event): void {
    // this.highlightConnections(event);   
    this.db.getAsEvent(event).then((success) => {
      if(!this.force) {
        this.setupData(success);
        this.createForce();
      } else {
        this.updateData(success);
      }
    });
  }
  
  private filterEvents(value: string): Array<Event> {
    const filterValue = value.toLowerCase();
    return this.items.filter(event => event.name.toLowerCase().indexOf(filterValue) === 0);
  }

  toggleNodes($event: any): void {
    if($event.checked) {
      this.svg.select('.nodes').style('opacity', 0);
    } else {
      this.svg.select('.nodes').style('opacity', 1);
    }
  }

  toggleLinks($event: any): void {
    if($event.checked) {
      this.svg.select('.links').style('opacity', 0);
      this.svg.select('.labels').style('opacity', 0);
    } else {
      this.svg.select('.links').style('opacity', 1);
      this.svg.select('.labels').style('opacity', 1);
    }
  }
  // TODO: implement following functions
  toggleLinked($event: any): void {
    
  }
  toggleUnlinked($event: any): void {

  }

  clearHighlighting(): void {
    this.linkSVG.attr('opacity', 1).attr('stroke-width', '1px');
    this.labelSVG.attr('opacity', 1);
    this.nodeSVG.attr('opacity', 1);
  }

  highlightConnections(node: any, opacity?: number): void {
    let targetsFound = new Array<any>();
    // links
    // console.log(node);
    this.linkSVG.attr('opacity', (d: any) => {
      if(d.sourceId === node.objectId || d.targetId === node.objectId) {
        targetsFound.push(d.targetId);
        targetsFound.push(d.sourceId);
        return 1;
      } else {
        return opacity ? opacity : 0;
      }
    }).attr('stroke-width', (d: any) => {
      if(d.sourceId === node.objectId || d.targetId === node.objectId) {
        return '8px';
      } 
    });
    // labels
    this.labelSVG.attr('opacity', (d: any) => {
      if(d.sourceId === node.objectId) {
        return 1;
      } else if(d.targetId === node.objectId) {
        targetsFound.push(d.sourceId);
        return 1;
      } else {
        return opacity ? opacity : 0;
      }
    });
    // nodes
    this.nodeSVG.attr('opacity', (d: any) => {
      if(targetsFound.includes(d.objectId) || d.objectId === node.objectId) {
        return 1;
      } else {
        return opacity ? opacity : 0;
      }
    });

    // let connections = this.links.filter((l: any) => { return l.sourceId === node.objectId; });
    // console.log(connections);
  }

  // getIndexById(id: string): number {
  //   return this.items.map((p: Event) => { return p.objectId}).indexOf(id);
  // }

  setupData(data: any): void {
    // this is where we will create our nodes and links array
    // node {x,y} link {source, target}

    // ALL NODES (everything related to the ego node)
    let root = <SimulationNodeDatum>data;
    root['type'] = 'event';
    this.nodes.push(root);

    
    for(let i = 0; i < data.events.length; i++) {
      let e = data.events[i];
        let node = <SimulationNodeDatum>e.event;
        node['type'] = 'event';
        this.nodes.push(node);
    }
    for(let i = 0; i < data.themes.length; i++) {
      let t = data.themes[i];
        let node = <SimulationNodeDatum>t.theme;
        node['type'] = 'theme';
        this.nodes.push(node);
    }
    for(let i = 0; i < data.locations.length; i++) {
      let l = data.locations[i];
        let node = <SimulationNodeDatum>l.location;
        node['type'] = 'location';
        this.nodes.push(node);
    }
    for(let i = 0; i < data.historicEvents.length; i++) {
      let h = data.historicEvents[i];
        let node = <SimulationNodeDatum>h.historicEvent;
        node['type'] = 'historicevent';
        this.nodes.push(node);
    }
    for(let i = 0; i < data.peopleOrganizations.length; i++) {
      let p = data.peopleOrganizations[i];
      if(!this.checkIfNodeExists(p.personOrganization.objectId)) {
        let node = <SimulationNodeDatum>p.personOrganization;
        node['type'] = 'personorganization';
        this.nodes.push(node);
      }
    }
    for(let i = 0; i < data.sources.length; i++) {
      let s = data.sources[i];
        let node = <SimulationNodeDatum>s.source;
        node['type'] = 'source';
        this.nodes.push(node);
    }


    // ALL LINKS
    data.events.forEach((e: any) => {
      if(!this.checkIfLinkExists(data.objectId, e.event.objectId)) {
        this.links.push({
          source: data,
          sourceId: data.objectId,
          target: e.event,
          targetId: e.event.objectId,
          label: e.relationship
        });
      }
    });
    data.themes.forEach((t: any) => {
      if(!this.checkIfLinkExists(data.objectId, t.theme.objectId)) {
        this.links.push({
          source: data,
          sourceId: data.objectId,
          target: t.theme,
          targetId: t.theme.objectId,
          label: t.relationship
        });
      }
    });
    data.locations.forEach((e: any) => {
      if(!this.checkIfLinkExists(data.objectId, e.location.objectId)) {
        this.links.push({
          source: data,
          sourceId: data.objectId,
          target: e.location,
          targetId: e.location.objectId,
          label: e.relationship
        });
      }
    });
    data.historicEvents.forEach((h: any) => {
      if(!this.checkIfLinkExists(data.objectId, h.historicEvent.objectId)) {
        this.links.push({
          source: data,
          sourceId: data.objectId,
          target: h.historicEvent,
          targetId: h.historicEvent.objectId,
          label: h.relationship
        });
      }
    });
    data.peopleOrganizations.forEach((p: any) => {
      if(!this.checkIfLinkExists(data.objectId, p.personOrganization.objectId)) {
        this.links.push({
          source: data,
          sourceId: data.objectId,
          target: p.personOrganization,
          targetId: p.personOrganization.objectId,
          label: p.relationship
        });
      }
    });
    data.sources.forEach((s: any) => {
      if(!this.checkIfLinkExists(data.objectId, s.source.objectId)) {
        this.links.push({
          source: data,
          sourceId: data.objectId,
          target: s.source,
          targetId: s.source.objectId,
          label: s.relationship
        });
      }
    });
  }

  checkIfNodeExists(objectId: string): boolean {
    let nodeExists = false;
    for(let i = 0; i < this.nodes.length; i++) {
      let l = this.nodes[i];

      if(l.objectId === objectId) {
        nodeExists = true;
        return nodeExists;
      }
    }
    return nodeExists;
  }

  checkIfLinkExists(sourceId: string, targetId: string): boolean {
    let linkExists = false;
    for(let i = 0; i < this.links.length; i++) {
      let l = this.links[i];

      if(sourceId === l.sourceId && targetId === l.targetId || 
        sourceId === l.targetId && targetId === l.sourceId) {
        linkExists = true;
        return linkExists;
      }
    }
    
    return linkExists;
  }

  // TODO: -> TL support?  (https://github.com/alangrafu/timeknots/blob/master/src/timeknots.js) something simple
  // TODO: Links between multiple graph clusters (when adding/selecting new event)
  // Maybe lookinto visjs network
  // we only check if node !exists then if edge exists we skip
  // if node exists we dont check edges -> FIXME:
  updateData(data: any): void {
    if(!this.checkIfNodeExists(data.objectId)) {
      let root = <SimulationNodeDatum>data;
      root['type'] = 'event';
      this.nodes.push(root);
    }
    
    if(data.events) {  
      for(let i = 0; i < data.events.length; i++) {
        let e = data.events[i];
        // NODES
        if(!this.checkIfNodeExists(e.event.objectId)) {
          let node = <SimulationNodeDatum>e.event;
          node['type'] = 'event';
          this.nodes.push(node);
          // if node doesnt exist the link doesnt as well
          if(this.checkIfLinkExists(data.objectId, e.event.objectId)) continue;
          this.links.push({
            source: data,
            sourceId: data.objectId,
            target: e.event,
            targetId: e.event.objectId,
            label: e.relationship
          });
        }
      }
    }
    if(data.locations) {
      for(let i = 0; i < data.locations.length; i++) {
        let e = data.locations[i];
        // NODES
        if(!this.checkIfNodeExists(e.location.objectId)) {
          let node = <SimulationNodeDatum>e.location;
          node['type'] = 'location';
          this.nodes.push(node);
          if(this.checkIfLinkExists(data.objectId, e.location.objectId)) continue;
          this.links.push({
            source: data,
            sourceId: data.objectId,
            target: e.location,
            targetId: e.location.objectId,
            label: e.relationship
          });
        } 
      }
    }

    if(data.peopleOrganizations) {
      for(let i = 0; i < data.peopleOrganizations.length; i++) {
        let e = data.peopleOrganizations[i];
        // NODES
        if(!this.checkIfNodeExists(e.personOrganization.objectId)) {
          let node = <SimulationNodeDatum>e.personOrganization;
          node['type'] = 'personorganization';
          this.nodes.push(node);
          if(this.checkIfLinkExists(data.objectId, e.personOrganization.objectId)) continue;
          this.links.push({
            source: data,
            sourceId: data.objectId,
            target: e.personOrganization,
            targetId: e.personOrganization.objectId,
            label: e.relationship
          });
        }
      }
    }

    if(data.sources) {
      for(let i = 0; i < data.sources.length; i++) {
        let e = data.sources[i];
        // NODES
        if(!this.checkIfNodeExists(e.source.objectId)) {
          let node = <SimulationNodeDatum>e.source;
          node['type'] = 'source';
          this.nodes.push(node);
          if(this.checkIfLinkExists(data.objectId, e.source.objectId)) continue;
          this.links.push({
            source: data,
            sourceId: data.objectId,
            target: e.source,
            targetId: e.source.objectId,
            label: e.relationship
          });
        }
      }
    }

    if(data.themes) {
      for(let i = 0; i < data.themes.length; i++) {
        let e = data.themes[i];
        // NODES
        if(!this.checkIfNodeExists(e.theme.objectId)) {
          let node = <SimulationNodeDatum>e.theme;
          node['type'] = 'theme';
          this.nodes.push(node);
          if(this.checkIfLinkExists(data.objectId, e.theme.objectId)) continue;
          this.links.push({
            source: data,
            sourceId: data.objectId,
            target: e.theme,
            targetId: e.theme.objectId,
            label: e.relationship
          });
        }
      }
    }

    if(data.historicEvents) {
      for(let i = 0; i < data.historicEvents.length; i++) {
        let e = data.historicEvents[i];
        // NODES
        if(!this.checkIfNodeExists(e.historicEvent.objectId)) {
          let node = <SimulationNodeDatum>e.historicEvent;
          node['type'] = 'historicevent';
          this.nodes.push(node);
          if(this.checkIfLinkExists(data.objectId, e.historicEvent.objectId)) continue;
          this.links.push({
            source: data,
            sourceId: data.objectId,
            target: e.historicEvent,
            targetId: e.historicEvent.objectId,
            label: e.relationship
          });
        }
      }
    }
    this.updateElements();
  }

  lookupItem(item: any): void {
    switch(item.type) {
      case 'event':
        this.db.getAsEvent(item).then((success) => {
          success.vx = item.vx;
          success.vy = item.vy;
          success.x = item.x;
          success.y = item.y;
          this.updateData(success);
        });
        return;
      case 'historicevent':
        this.db.getAsHistoricEvent(item).then((success) => {
          success.vx = item.vx;
          success.vy = item.vy;
          success.x = item.x;
          success.y = item.y;
          this.updateData(success);
        });
        return;
      case 'location':
        this.db.getAsLocation(item).then((success) => {
          success.vx = item.vx;
          success.vy = item.vy;
          success.x = item.x;
          success.y = item.y;
          this.updateData(success);
        });
        return;
      case 'theme':
        this.db.getAsTheme(item).then((success) => {
          success.vx = item.vx;
          success.vy = item.vy;
          success.x = item.x;
          success.y = item.y;
          this.updateData(success);
        });
        return;
      case 'source':
        this.db.getAsSource(item).then((success) => {
          success.vx = item.vx;
          success.vy = item.vy;
          success.x = item.x;
          success.y = item.y;
          this.updateData(success);
        });
        return;
      case 'personorganization':
        this.db.getAsPersonOrganization(item).then((success) => {
          success.vx = item.vx;
          success.vy = item.vy;
          success.x = item.x;
          success.y = item.y;
          this.updateData(success);
        });
        return;
      default: return;
    }
  }

  createForce(): void {
    // this is where we will create our force simulation
    // elements and apply the enter, update, exit, merge pattern in d3

    // TODO: improve the force(s) - currently pushing clusters too far away
    this.createElements();
  }

  updateElements(): void {  
    this.force.stop();

    this.linkSVG = this.linkSVG.data(this.links, (d: any) => { return d.source.sourceId + '-' + d.target.targetId; });
    this.linkSVG.exit().remove();
    this.linkSVG = this.linkSVG.enter().append('line').attr('class', 'link').merge(this.linkSVG);


    this.nodeSVG = this.nodeSVG.data(this.nodes, (d: any) => { return d.objectId; });
    this.nodeSVG.exit().remove();
    this.nodeSVG = this.nodeSVG.enter()
                    .append('circle')
                    .attr('fill', (d: any) => { return this.colors.get(d.type); })
                    .attr('r', this.GLYPH_WIDTH/2)
                    .on('click', (d: any) => {
                      this.lookupItem(d);
                    })
                    .on('mouseover', (d: any) => {
                      this.tooltip.transition()		
                                  .duration(200)		
                                  .style("opacity", .9);		
                      this.tooltip.html(d.name)	
                                  .style("left", (d3.event.pageX) + "px")		
                                  .style("top", (d3.event.pageY - 28) + "px");	
                    })
                    .on('mouseout', () => {
                      this.tooltip.transition()
                                  .duration(200)
                                  .style('opacity', 0);
                    })
                    .merge(this.nodeSVG);
                    
    this.force.nodes(this.nodes);
    this.force.force('link').links(this.links);
    this.force.alpha(1);
    this.force.restart();
  }


  createElements(): void {
    this.svg = d3.select('#people-wrapper').append('svg')
                 .attr('width', this.SVG_WIDTH)
                 .attr('height', this.SVG_HEIGHT);
                 
    this.g = this.svg.append('g');
    
    this.linkSVG = this.g.append('g')
                          .selectAll('link')
                          .enter()
                          .data(this.links, (d: any) => { return d.source.sourceId + '-' + d.target.targetId; });
                          
    this.nodeSVG = this.g.append('g')
                          .selectAll('node')
                          .enter()
                          .data(this.nodes, (d: any) => { return d.objectId; });
    
    this.zoom = d3.zoom().on('zoom', () => {
      this.g.attr("transform", d3.event.transform);
    });

    // TODO: when using #people-wrapper the tooltip is off probably CSS issue
    this.tooltip = d3.select('body').append('div').attr('class', 'tooltip').style('opacity', 0);

    this.zoom(this.svg);

    this.force = d3.forceSimulation()
    // .alphaDecay(0.5)
    // .alphaTarget(1)
    .force('link', d3.forceLink().distance(50).strength(1)) //distance(this.LINK_DISTANCE/5) //
    .force('charge', d3.forceManyBody().strength(-1000))
    // .force('xPos', d3.forceX(this.SVG_WIDTH / 2))
    // .force('yPos', d3.forceY(this.SVG_HEIGHT / 2))
    .force('center', d3.forceCenter(this.SVG_WIDTH/2, this.SVG_HEIGHT/2))
    // .force('collision', d3.forceCollide().radius((d: any) => { return this.GLYPH_WIDTH/2; }))
    .on('tick', () => {
      this.ticked()
    });

    // this.force.stop();

     this.updateElements();
    // Force-directed edge bundling https://bl.ocks.org/vasturiano/7c5f24ef7d4237f7eb33f17e59a6976e
  }
  
  ticked(): void {
    this.nodeSVG.attr('class', 'node')
                .attr('id', (d: any) => { return d.objectId; })
                .attr('cx', (d: any) => { return d.x; })
                .attr('cy', (d: any) => { return d.y; });

    this.linkSVG.attr('class', 'link')
                // .attr('d', () => { return this.line; })
                .attr('source', (d: any) => { return d.sourceId; })
                .attr('target', (d: any) => { return d.targetId; })
                .attr('x1', (d: any) => { 
                  let source = this.nodes.find((n: any) => { return n.objectId === d.sourceId; });
                  return source ? source.x : d.source.x;
                })
                .attr('y1', (d: any) => { 
                  let target = this.nodes.find((n: any) => { return n.objectId === d.sourceId; });
                  return target ? target.y : d.target.y;
                 })
                .attr('x2', (d: any) => { return d.target.x; })
                .attr('y2', (d: any) => { return d.target.y; });
  }

  createNode(event: Event, nodeElement: any): void {
    let data = [
      {name: 'People', value: 60},
      {name: 'Places', value: 60},
      {name: 'Events', value: 60},
      {name: 'Themes', value: 60},
      {name: 'Sources', value: 60},
      {name: 'Historic Events', value: 60}
    ];
    let text = '';
    
    let width = this.GLYPH_WIDTH;
    let height = this.GLYPH_HEIGHT;
    let thickness = this.GLYPH_WIDTH/3.75;
    
    let radius = Math.min(width, height) / 2;
    let color = d3.scaleOrdinal(d3.schemeCategory10);
    
    let glyph = d3.select(nodeElement);
    let g = glyph.append('g') 
                 .attr('class', 'pie')
                 .attr('width', width)
                 .attr('height', height);
    
    g.append('circle').attr('r', (this.GLYPH_HEIGHT/2) - 2).attr('fill', 'white');
    
    let arc = d3.arc()
                .padAngle(0.05)
                .innerRadius(radius - thickness)
                .outerRadius(radius);
    
    let extArc = d3.arc()
                    .padAngle(0.05)
                    .innerRadius(radius - thickness)
                    .outerRadius(radius + thickness)
    
    let pie = d3.pie()
                .sort(null)
                .value((d: any) => { return d.value; });
    // relative pixel values
    // apply after transformation that has been applied to global group
    let coords = [
      { x: 1, y: -95 }, 
      { x: 32, y: -18 },
      { x: 1, y: 20 },
      { x: -201, y: 20 },
      { x: -232, y: -18, }, 
      { x: -201, y: -95 }
    ]

    let path = g.selectAll('path')
      .data(pie(<any>data))
      .enter()
      .append('g');
      g.append('text')
      .attr('class', 'name-text')
      .text(`${event.name}`)
      .attr('text-anchor', 'middle')
      .attr('dy', '-2.6em');
      
      path.append('path')
      .attr('d', <any>arc)
      .attr('fill', (d: any,i: any) => color(i))
      .on('mouseover', (d, i: any, n: any) => {
          // let centroid = arc.centroid(<any>d);
          d3.select(n[i])
          .transition()
          .delay(250)
          .attr('d', extArc)
          .style('cursor', 'pointer')
          .style('fill', color(n[i]['_current']));
      })
      .on('mouseout', (d: any, i: any, n: any) => {
          d3.select(n[i])
          .transition()
          .delay(250)
          .attr('d', arc)
          .style('cursor', 'none')  
          .style('fill', color(n[i]['_current']));
      })
      .each(function(d: any, i: any) { this['_current'] = i; });
      
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .text(text);

    g.on('click', (d: any) => {
      this.highlighted = true;
      this.highlightConnections(d);
    });
    g.on('mouseover', (d: any) => {
      if(!this.highlighted) { // if not highlighted
        this.highlightConnections(d, 0.1);
      }
    })
    g.on('mouseout', () => {
      if(!this.highlighted) {
        this.clearHighlighting();
      }
    });

  }
}
