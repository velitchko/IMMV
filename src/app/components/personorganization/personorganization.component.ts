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
  tooltip: any;
  line: any;

  // Size setup
  private SVG_WIDTH: number = 1850;
  private SVG_HEIGHT: number = 860;
  private GLYPH_WIDTH: number = 75;
  private GLYPH_HEIGHT: number = 75;
  private LINK_DISTANCE: number = 500;

  constructor(private db: DatabaseService,
              @Inject(PLATFORM_ID) private _platformId: Object) {
    this.isBrowser = isPlatformBrowser(this._platformId);
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
      if(this.isBrowser) {
        this.setupData();

        this.createForce();
        // this.tooltip = d3.select('#people-wrapper')
        // .append('div')
        // .attr('class', 'slice-extension')
        // .style('opacity', 0);
        // this.svg = d3.select('#people-wrapper').append('svg')
        // .attr('width', this.SVG_WIDTH)
        // .attr('height', this.SVG_HEIGHT);
        // this.createNode(this.peopleOrganizations[0], 'svg');
        // this.createNode(this.peopleOrganizations[1], 'svg');
      }
    });
  }
  selectedItem(event: Event): void {
    console.log(event);
    this.highlightConnections(event);   
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

  getIndexById(id: string): number {
    return this.items.map((p: Event) => { return p.objectId}).indexOf(id);
  }

  setupData(): void {
    // this is where we will create our nodes and links array
    // node {x,y} link {source, target}
    this.items.forEach((p: Event) => {
      this.nodes.push(<SimulationNodeDatum>p);
    });
    this.items.forEach((p: Event) => {
      p.events.forEach((rel: any) => {
        // rel.personOrganization id
        // rel.relationship 
          // let s = this.getIndexById(p.objectId);
          // console.log(rel);
          // let t = this.getIndexById(rel.event.objectId);
          // console.log(s,t);
        this.links.push({
          source: this.getIndexById(p.objectId),
          sourceId: p.objectId,
          target: this.getIndexById(rel.event.objectId),
          targetId: rel.event.objectId,
          label: rel.relationship
        })
      })
    });
    let cycles = new Set<number>();
    this.links.forEach((s: any, tIdx: number) => {
      this.links.forEach((t: any) => {
          if(s.targetId === t.sourceId && s.sourceId === t.targetId) {
            // cycle 
            cycles.add(tIdx);
          }
        })
      });
    // remove cycles
    cycles.forEach((c: number) => { this.links.splice(c, 1); });
    // remove isolated nodes
  }

  createForce(): void {
    // this is where we will create our force simulation
    this.force = d3.forceSimulation(this.nodes)
                   .velocityDecay(0.1)
                   .force('charge', d3.forceManyBody().strength(-250))
                   .force('x', d3.forceX(this.SVG_WIDTH / 2).strength(.05))
                   .force('y', d3.forceY(this.SVG_HEIGHT / 2).strength(.05))
                   .force('center', d3.forceCenter(this.SVG_WIDTH/2, this.SVG_HEIGHT/2))
                   .force('collision', d3.forceCollide().radius((d: any) => { return this.GLYPH_WIDTH/2; }))
                   .force('link', d3.forceLink().distance(this.GLYPH_WIDTH + this.LINK_DISTANCE).strength(2));
    this.force.on('tick', this.ticked.bind(this));

    this.createElements();
  }

  createElements(): void {
    this.svg = d3.select('#people-wrapper').append('svg')
                 .attr('width', this.SVG_WIDTH)
                 .attr('height', this.SVG_HEIGHT);

    let wrapper = this.svg.append('g').attr('class', 'wrapper');
    // Force-directed edge bundling https://bl.ocks.org/vasturiano/7c5f24ef7d4237f7eb33f17e59a6976e
    this.linkSVG = wrapper.append('g').attr('class', 'links').selectAll('line').data(this.links).enter().append('line')

    this.nodeSVG = wrapper.append('g').attr('class', 'nodes').selectAll('g').data(this.nodes).enter().append('g');
   
    this.nodeSVG.each((d: any, i: number, n: any) => {
        this.createNode(this.items[i], n[i]);
    });

    this.labelSVG = wrapper.append('g')
                            .attr('class', 'labels')
                            .selectAll('g')
                            .data(this.links)
                            .enter()
                            .append('g')
                            .append('text');
    
    // this.tooltip = d3.select('#people-wrapper')
    //                  .append('div')
    //                  .attr('class', 'slice-extension')
    //                  .style('opacity', 0);

    this.force.nodes(this.nodes);
    this.force.force('link').links(this.links);

    let zoom = d3.zoom()
                 .translateExtent([[0,0], [this.SVG_WIDTH, this.SVG_HEIGHT]])
                 .on('zoom', () => {
                   wrapper.attr('transform', d3.event.transform)
                 });
    zoom(wrapper);
  }
  
  ticked(): void {
    this.nodeSVG.attr('class', 'node')
                .attr('id',(d: any) => { return d.objectId; })
                .attr('x', (d: any) => { return d.x + this.GLYPH_WIDTH/2; })
                .attr('y', (d: any) => { return d.y + this.GLYPH_HEIGHT/2; })
                .attr('transform', (d: any) => { 
                  return `translate(${d.x + this.GLYPH_WIDTH/2}, ${d.y + this.GLYPH_HEIGHT/2})`;
                });

    this.linkSVG.attr('class', 'link')
                // .attr('d', () => { return this.line; })
                .attr('source', (d: any) => { return d.sourceId; })
                .attr('target', (d: any) => { return d.targetId; })
                .attr('x1', (d: any) => { return d.source.x + this.GLYPH_WIDTH/2; })
                .attr('y1', (d: any) => { return d.source.y + this.GLYPH_HEIGHT/2; })
                .attr('x2', (d: any) => { return d.target.x + this.GLYPH_WIDTH/2; })
                .attr('y2', (d: any) => { return d.target.y + this.GLYPH_HEIGHT/2; });

    this.labelSVG.attr('class', 'label')
                 .attr('source', (d: any) => { return d.sourceId; })
                 .attr('target', (d: any) => { return d.targetId; })
                 .attr('x', (d: any) => { 
                      return (d.source.x + d.target.x)/2;
                  })
                 .attr('y', (d: any) => { 
                     return (d.source.y + d.target.y)/2;
                 })
                 .attr('transform', function(d: any, i: number) {
                  //  if(d.target.x < d.source.x) {
                  //    let bbox = this.getBBox();
                  //    let rx = bbox.x + bbox.width/2;
                  //    let ry = bbox.y + bbox.height/2;
                  //    return `rotate(180 ${rx} ${ry})`;
                  //  } else {
                     return 'rotate(0)';
                  //  }
                 })
                 .text((d: any ) => { return d.label; });;
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
                 .attr('height', height)
                //  .attr('transform', `translate(${this.SVG_WIDTH/2}, ${this.SVG_HEIGHT/2})`);
    
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
      // .on('mouseover', function(d: any) {
      //     let g = d3.select(this)
      //       .style('cursor', 'pointer')
      //       .style('fill', 'black')
      //       .append('g')
      //       .attr('class', 'text-group');
      //       // REF: http://jsfiddle.net/henbox/88t18rqg/6/
      //       // add image inside of arc section
      //     g.append('text')
      //       .attr('class', 'name-text')
      //       .text(`${event.name}`)
      //       .attr('text-anchor', 'middle')
      //       .attr('dy', '-2.6em');
      
      //     // g.append('text')
      //     //   .attr('class', 'value-text')
      //     //   .text(`${d.data.value}`)
      //     //   .attr('text-anchor', 'middle')
      //     //   .attr('dy', '.6em');
      // })
      // .on('mouseout', function(d: any) {
      //     d3.select(this)
      //       .style('cursor', 'none')  
      //       .style('fill', color(this['_current']))
      //       .select('.text-group').remove();
      // })
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

          // let parent = (<HTMLElement>n[i]).parentNode.parentNode.parentNode;
          // let xOff = d3.select(parent).attr('x');
          // let yOff = d3.select(parent).attr('y');
          // let x = coords[i].x;
          // let y = coords[i].y;
          // console.log(xOff, x, yOff, y);
          
          // this.tooltip
           
            // d3.select(parent)
            // .append('div')
            // .html('<p>Tooltippy boi</p>')
            // .transition()
            // .delay(250)
            // .attr('class', 'slice-extension')
            // .style('opacity', 1)
            // // .style('transform', `translate(${xOff}, ${yOff})`)
            // .style('background-color', color(n[i]['_current']))
            // .style('left', `${x}px`)
            // .style('top', `${y}px`);;
        })
      .on('mouseout', (d: any, i: any, n: any) => {
          d3.select(n[i])
          .transition()
          .delay(250)
          .attr('d', arc)
          .style('cursor', 'none')  
          .style('fill', color(n[i]['_current']));

          // let parent = (<HTMLElement>n[i]).parentNode.parentNode.parentNode;
          // d3.select(parent).selectAll('.slice-extension').remove();
          // // d3.select((<HTMLElement>this).parentNode).selectAll('rect').remove();

          // this.tooltip
          //   .transition()
          //   .delay(250)
          //   .style('opacity', 0);
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
