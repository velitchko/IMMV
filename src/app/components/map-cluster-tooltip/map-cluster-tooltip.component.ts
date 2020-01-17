import { Component, Input, Inject, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { Event } from '../../models/event';
import { MusicMapService } from '../../services/musicmap.service';
import * as d3 from 'd3';

@Component({
  selector: 'app-map-cluster-tooltip',
  templateUrl: './map-cluster-tooltip.component.html',
  styleUrls: [ './map-cluster-tooltip.component.scss' ]
})

export class MapClusterTooltipComponent {
  @Input() events: Array<Event>;
  isBrowser: boolean;
  eventsOut: Array<any>; //event, svg (as string)
  // currentColorAssignment: Map<string, string>;
  dataProcessed:boolean = false;
  constructor(@Inject(PLATFORM_ID) private _platformId: Object,
              private mms: MusicMapService,
              private cd: ChangeDetectorRef) {
    this.isBrowser = isPlatformBrowser(this._platformId);
    // this.currentColorAssignment = new Map<string, string>();
    if(this.isBrowser) {
    }
    // preprocessing
    this.eventsOut = new Array<any>();
  }

  ngAfterViewInit(): void {
    this.events.forEach( (event: any) => {
      let themeMap = new Map<string, number>();
      for(let t of event.themes) {
        themeMap.set(t.theme.name, 1); // one theme should not occurr multiple times in same event
      }
      this.eventsOut.push({
        event: event,
        svg: this.generateSVGIcon(themeMap)
      });
    });
    this.sortByDate(this.eventsOut);
    this.dataProcessed = true;
    this.cd.detectChanges();
  }

  /**
   * Sorts the items array based on start date
   */
  sortByDate(items: Array<any>): void {
    items.sort( (a: any, b: any) => {
      // need to use .valueOf to perform Date object arithmetic in typescript
      return new Date(b.event.startDate).valueOf() - new Date(a.event.startDate).valueOf();
    }).reverse(); // reversal needed so first element has earliest starting date
  }

  /**
   * Generate SVG icon for a distribution of themes
   * @param themeMap - map<string,number> theme name and its count
   * @return string - SVG as string
   */
  generateSVGIcon(themeMap: Map<string, number>): string {
    // add tooltip
    let data = Array.from(themeMap);
    let width = 35; // in pixels
    let height = 35; // in pixels
    let thickness = 7; // in pixels

    let radius = Math.min(width, height) / 2;

    let svg = d3.select('body').append('svg')
    .remove() // remove it after creating so we can create the icon and then return the HTML as a string to L
    .attr('class', 'custom-cluster-icon')
    .attr('width', width)
    .attr('height', height)

    let g = svg.append('g')
    .attr('transform', 'translate(' + (width/2) + ',' + (height/2) + ')');
    // in case that no themes are asssociated with the event
    // the cluster marker only appears as a gray circle
    // so we do 2 circles one outer, one inner
    // outerone gets covered by the donut chart if there are themes
    g.append("circle") //background circle fill
    .attr("cx", 0)
    .attr("cy", 0)
    .attr("r", radius)
    .attr("fill", "#afafaf");
    g.append("circle") //background circle fill
    .attr("cx", 0)
    .attr("cy", 0)
    .attr("r", radius - thickness)
    .attr("fill", "#FFFFFF");

    let arc = d3.arc()
    .innerRadius(radius - thickness)
    .outerRadius(radius);

    let pie = d3.pie();
    let values = data.map( m => { return m[1]; });

    let path = g.selectAll('path')
      .data(pie(values))
      .enter()
      .append('g')
      .append('path')
      .attr('d', <any>arc)
      .attr('fill', (d, i) => {
        return 'black';
        // return this.currentColorAssignment.get(data[i][0]);
      })
      .transition()
      .delay((d, i) => { return i * 500; })
      .duration(500)
      .attrTween('d', (d: any) => {
          var i = d3.interpolate(d.startAngle+0.1, d.endAngle);
          return function(t: any) {
              d.endAngle = i(t);
            return arc(d);
          }
      });

    return `<svg xmlns=\"http://www.w3.org/2000/svg\" class=\"cluster-tooltip-icon\" viewBox=\"0 0 35 35\">${svg.html()}</svg>`;
  }

  /**
   * Open the side preview panel
   * @param e - the event and its attributes
   */
  openPreviewPanel(e: Event): void {
    this.mms.setSelectedEvent(e.objectId);
  }
}
