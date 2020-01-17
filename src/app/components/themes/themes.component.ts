import { Component, Inject, OnInit, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { Event } from '../../models/event';
import { Theme } from '../../models/theme';
import { MusicMapService } from '../../services/musicmap.service';
// import { ColorService } from '../../services/color.service';
import * as D3 from 'd3';
// for the layout.cloud function
declare var d3: any;

@Component({
  selector: 'app-theme',
  templateUrl: './themes.component.html',
  styleUrls: [ './themes.component.scss' ]
})

export class ThemeComponent implements OnInit {
  isBrowser: boolean;
  themes: Array<Theme>;
  events: Array<Event>;
  distribution: Map<string, number>;
  loading: boolean = true;
  options: any;
  width: number;
  height: number;
  fill: Function;
  wordcloud: any;
  MAX_TRIES: number = 6;
  hostEl: any;
  svg: any;
  margin: any = {
    top: 20,
    left: 20,
    right: 20,
    bottom: 20
  };
  themesToDraw: Array<any>;
  colors: Array<any>;
  constructor(@Inject(PLATFORM_ID) private _platformId: Object,
              @Inject('WINDOW') private window: any,
              private mms: MusicMapService,
              // private cs: ColorService
              ) {
    this.isBrowser = isPlatformBrowser(this._platformId);
    // this.width = 800 - this.margin.left - this.margin.right;
    // this.height = 400 - this.margin.top - this.margin.bottom;
    this.themes = new Array<Theme>();
    this.events = new Array<Event>();
    this.themesToDraw = new Array<any>();
    this.distribution = new Map<string, number>();
    this.colors = new Array<any>();
    // if(!this.ts.getThemes().length) {
    //   this.ts.getAllThemes().then(
    //     (success) => {
    //     //  console.log(success);
    //       this.themes = this.ts.getThemes();
    //       //console.log(this.themes);
    //     },
    //     (error) => {
    //       console.log(error);
    //     });
    // }

  }

  ngOnInit(): void { }

  ngAfterViewInit(): void {
    // if(!this.es.getEvents().length) {
    //   this.es.getAllEvents().then(
    //     (success) => {
    //       //  console.log(success);
    //       this.events = this.es.getEvents();
    //       //console.log(this.events);
    //       this.loading = false;
    //       this.computeDistribution();
    //       this.createWordCloud();
    //     },
    //     (error) => {
    //       console.log(error);
    //     });
    //   } else {
    //     this.events = this.es.getEvents();
    //     // we gucci
    //     console.log('already loaded');
    //     this.loading = false;
    //     this.computeDistribution();
    //     this.createWordCloud();
    //   }
  }


  ngOnDestroy(): void {
    console.log('destroying...');
  }

  /**
   * Shares the color assignment computed from this component with the MusicMapService
   */
  updateColorAssignment(): void {
    let colorAssignmentMap = new Map<string, string>();
    //sort and construct map
    Array.from(this.distribution.entries())
      .sort((a, b) => b[1] - a[1])
      .map((m) => { return m[0]; })
      .forEach(
        (k, idx) => {
          colorAssignmentMap.set(k, this.colors[idx]);
        }
    );

    // this.mms.setColorAssignment(colorAssignmentMap);
  }

  computeDistribution(): any {
    for(let e of this.events) {
      for(let t of e.themes) {
          // console.log(`${e.recordId}: ${t.names[0].name}`);
          // console.log(`in map ${this.distribution.get(t.names[0].name)}`);
          this.distribution.set(t.theme.name, this.distribution.get(t.theme.name) ? this.distribution.get(t.theme.name) + 1 : 1);
        }
    }
    // assign colors
    this.colors = [];
    // this.colors = this.cs.getColors(this.distribution.size);
    // here we want to update the color assignment in the MusicMapService
    // so we can share the color assignment to our markers in the map / tl
    this.updateColorAssignment();
  }

  createWordCloud(): void {
    if(this.isBrowser) {
      // set width / height
      this.width = this.window.innerWidth;
      this.height = this.window.innerHeight;
      console.log(`w: ${this.width} h: ${this.height}`);
      // pack map into JSON arr
      this.distribution.forEach( (value: number, key: string) => {
        this.themesToDraw.push({text: key, size: value*4});
      });
      this.createElements();
      this.generateSkillCloud();
      console.log(this.hostEl.html());
    }
  }
  createElements(): void {
    this.fill = D3.scaleOrdinal(D3.schemeCategory10);
    this.hostEl = D3.select('#cloud');
    this.svg = this.hostEl.append('svg')
      .attr('width', this.width)
      .attr('height', this.height)

    let viewBox = [0, 0, this.width, this.height].join(" ");
    this.svg.attr("viewBox", viewBox);
  }

  generateSkillCloud(retryCycle?: number): void {
    d3.layout.cloud()
    .size([this.width, this.height])
    .words(this.themesToDraw)
    .rotate((d: any) => {
      return (~~(Math.random() * 2) - 1) * 90; // 6 -3 60
    })
    .font('Roboto')
    .fontSize((d: any) => {
      return d.size;
    })
    .spiral("rectangular")
    .on('end', (themeArr: any) => {
      // check if all words fit and are included
      if(themeArr.length == this.themesToDraw.length) {
        console.log('layout done');
        this.drawSkillCloud(themeArr); // finished
      }
      else if(!retryCycle || retryCycle < this.MAX_TRIES) {
        // words are missing due to the random placement and limited room space
        // try again and start counting retries
        console.log('retry ' + (retryCycle || 1));
        this.generateSkillCloud((retryCycle || 1) + 1);
      } else {
        // retries maxed and failed to fit all the words
        console.log('max retries');
        this.drawSkillCloud(themeArr);
    }
   })
    .start();
  }

  drawSkillCloud(words: Array<any>): void {
    let g = this.svg.append('g')
      .attr('transform','translate(' + this.margin.left + ',' + this.margin.top + ')');

    this.wordcloud = g.append("g")
      .attr('class','wordcloud')
      .attr("transform", "translate(" + this.width/2 + "," + this.height/2 + ")");

    this.wordcloud.selectAll('text')
    .data(words)
    .enter().append('text')
    .attr('class', 'word')
    .style('fill', (d: any, i: any) => {
      return this.mms.getColorAssignmentForCategory(d.text);
      //return this.fill(i);
    })
    .style('font-size', (d: any) => { return d.size + 'px'; })
    .on('mouseover', this.onWordMouseOver())
    .on('click', this.onWordMouseClick())
    .attr("text-anchor", "middle")
    .attr("transform", (d: any) => { return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")"; })
    .text((d: any) => { return d.text; });
  }

  onWordMouseOver(): (d: any, i: any, n: any) => void {
    return (d: any, i: any, n: any) => {
      console.log('mouseover');
      // n[i] - our text element ref
      // or use transform and add scale to it
      // return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")"; }) before or after
      D3.select(n[i]).style('font-size', (d: any) => {
        return d.size*4;
      })
    }
  }

  onWordMouseClick(): (d: any, i: any, n: any) => void {
    return (d: any, i: any, n: any) => {
      console.log('click');
      //
    }
  }
}
