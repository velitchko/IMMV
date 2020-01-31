import { Component, Input, Inject, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { Event } from '../../models/event';
import { MusicMapService } from '../../services/musicmap.service';
import { ThemeService } from '../../services/theme.service';
import * as d3 from 'd3';
import { Theme } from 'src/app/models/theme';

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
              private ts: ThemeService,
              private cd: ChangeDetectorRef) {
    this.isBrowser = isPlatformBrowser(this._platformId);
    // this.currentColorAssignment = new Map<string, string>();
    if(this.isBrowser) {
    }
    // preprocessing
    this.eventsOut = new Array<any>();
  }

  ngAfterViewInit(): void {
    this.events.forEach((event: Event) => {
      let themeMap = new Map<string, number>();
      event.themes.forEach((t: any) => {
        if(!this.ts.isMainTheme(t.theme)) return;
        if(themeMap.get(t.theme)) {
          themeMap.set(t.theme, themeMap.get(t.theme) + 1);
          return;
        }
        themeMap.set(t.theme, 1);
      });

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

    let pie = d3.pie().value((d: any) => { return d[1]; });
    let values: any[] = [...themeMap];
    let path = g.selectAll('path')
      .data(pie(values))
      .enter()
      .append('g')
      .append('path')
      .attr('d', <any>arc)
      .attr('fill', (d: any) => {
        return this.ts.getColorForTheme(d.data[0]);
      })
      .transition()
      .delay((d: any, i: number) => { return i * 500; })
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
    console.log(e);
    this.mms.setSelectedEvent(e.objectId);
  }
}
