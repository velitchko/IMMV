import { Component, OnInit, ViewChild, Inject, ElementRef } from '@angular/core';
import { DatabaseService } from '../../services/db.service';
import { PersonOrganization } from '../../models/person.organization';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { Event } from '../../models/event';
import { environment } from '../../../environments/environment';
import * as d3 from 'd3';
import * as L from 'leaflet';
import * as moment from 'moment';

@Component({
  selector: 'app-test',
  templateUrl: './test.component.html',
  styleUrls: [ './test.component.scss' ]
})

export class TestComponent implements OnInit {
  // HTML 
  @ViewChild('timeline') timelineContainer: ElementRef;
  @ViewChild('brush') brushContainer: ElementRef;
  @ViewChild('map') mapContainer: ElementRef;
  @ViewChild('tooltip') tooltip: ElementRef;

  // Dimensions
  WIDTH: number;
  HEIGHT: number;
  MIN_DATE: moment.Moment;
  MAX_DATE: moment.Moment;
  
  // D3 things
  timelineSVG: any;
  brushSVG: any;
  xScale: d3.ScaleTime<number, number>;
  yScale: d3.ScaleLinear<number, number>
  brush: d3.BrushBehavior<{}>;
  colors: d3.ScaleOrdinal<string, string>;
  
  // Leaflet things
  map: L.Map;
  mapMarkers: L.LayerGroup;
  mapLines: L.LayerGroup;

  // Data
  people: Array<PersonOrganization>;
  data: Array<any>;

  //internal things
  personHeightMap: Map<string, number>;
  // Config
  isBrowser: boolean;

  constructor(private db: DatabaseService, @Inject(PLATFORM_ID) private _platformId: Object) {
    this.people = new Array<PersonOrganization>();
    this.data = new Array<any>();
    this.personHeightMap = new Map<string, number>();

    this.colors = d3.scaleOrdinal(d3.schemePaired);

    this.isBrowser = isPlatformBrowser(this._platformId);
  }

  ngOnInit(): void { 
      this.db.getAllPeopleOrganizations().then((success: Array<PersonOrganization>) => {
        this.people = success;
        if(this.isBrowser) {
          
          this.prepareData();
          this.calculateScales();
          this.createBrush();
          this.createTimeline();
          // this.createMap();
        }
      });
  }

  prepareData(): void {
    this.people.forEach((person: PersonOrganization, i: number) => {
      // if(i > 100) return;
      if(person.objectType !== 'Person') return; // organizations later

      if(person.functions) {
        // functions
        person.functions.forEach((func: any) => {
          let dataPoint: any = {};
          if(!func.startDate) return;
          dataPoint.startDate = moment(func.startDate);
          func.endDate ? dataPoint.endDate = moment(func.endDate) : dataPoint.endDate = moment(func.startdate);
          dataPoint.person = person.name;
          dataPoint.dateName = func.dateName;
          dataPoint.personID = person.objectId;
          this.data.push(dataPoint);
        });

        // other dates
        person.dates.forEach((date: any) => {
          let dataPoint: any = {};
          dataPoint.startDate = moment(date.date); 
          dataPoint.endDate = moment(date.date); 
          dataPoint.dateName = date.dateName;
          dataPoint.person = person.name;
          dataPoint.personID = person.objectId;
          this.data.push(dataPoint);
        });
      }
    });
    console.log(this.data);
  }

  calculateScales(): void {
    this.WIDTH = this.timelineContainer.nativeElement.clientWidth;
    this.HEIGHT = this.timelineContainer.nativeElement.clientHeight;

    // our temporal range based on the data
    this.MIN_DATE = d3.min(this.data.map((d: any) => { return moment(d.startDate, ['YYYY-MM-DD', ]); }));
    this.MAX_DATE = moment(); // d3.max(this.data.map((d: any) => { return moment(d.endDate, ['YYYY-MM-DD']); })); 

    this.xScale = d3.scaleTime().domain([this.MIN_DATE, this.MAX_DATE]).range([0, this.WIDTH]);
    this.yScale = d3.scaleLinear().range([0, this.HEIGHT]);
  }


  createTimeline(): void {
    // get the x,y scales so we can draw things
    let margin = {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0
    };
    this.WIDTH = this.WIDTH - (margin.left + margin.right);
    this.HEIGHT = this.HEIGHT - (margin.top + margin.bottom);

    this.timelineSVG = d3.select(this.timelineContainer.nativeElement)
                    .append('svg')
                    .attr('width', this.WIDTH)
                    .attr('height', this.HEIGHT);
    // populate timeline
    this.createEvents();
  }

  createEvents(): void {
    // TODO:  use the enter, update/merge, exit, remove pattern
    let verticalPadding = 10;
    let dataByPerson = d3.nest()
                         .key((d: any) => { return d.person; })
                         .entries(this.data);
    let g = this.timelineSVG.append('g')
                    .attr('class', 'group')
                    .attr('transform', `translate(20, 20)`);
    let lineBeforeDeath = g.selectAll('.before-death').data(dataByPerson);
    lineBeforeDeath.enter()
        .append('line')
        .attr('class', 'before-death')
        .attr('stroke', (d: any) => { return '#b5b5b5'; })//this.colors(d.key); })
        .attr('stroke-width', 4)
        .attr('x1', (d: any) => { 
          let date = d3.min(d.values.map((v: any) => { return v.startDate; }))
          return this.xScale(moment(date));
        })
        .attr('x2', (d: any) => { 
          let date = d3.max(d.values.map((v: any) => { return v.endDate; }))
          return this.xScale(moment(date));
        })
        .attr('y1', (d: any, i: number) => {
          this.personHeightMap.set(d.key, i*(2 + verticalPadding));
          return i*(2 + verticalPadding);
        })
        .attr('y2', (d: any, i: number) => {
          return i*(2 + verticalPadding);
        })
        .on('mouseover', (d: any) => {
          let birthDate = d.values.find((dd: any) => { return dd.dateName === 'Birth'; }).startDate;
          let deathDate = d.values.find((dd: any) => { return dd.dateName === 'Death'; }).startDate;
          this.tooltip.nativeElement.style.opacity = '1';
          this.tooltip.nativeElement.style.top = `${d3.event.pageY}px`;
          this.tooltip.nativeElement.style.left = `${d3.event.pageX + 20}px`;
          this.tooltip.nativeElement.innerHTML = `
            <h2>${d.key}</h2>
            <p>Born: ${moment(birthDate).format('DD/MM/YYYY')} - Died: ${moment(deathDate).format('DD/MM/YYYY')}</p>
          `;
        })
        .on('mouseout', () => {
          this.tooltip.nativeElement.style.opacity = '0';
        });;
    
    let lineAfterDeath = g.selectAll('.after-death').data(dataByPerson);
    lineAfterDeath.enter()
        .append('line')
        .attr('class', 'after-death')
        .attr('stroke', (d: any) => { return '#b5b5b5'; })//this.colors(d.key); })
        .attr('stroke-width', 4)
        .attr('stroke-dasharray', 4)
        .attr('x1', (d: any) => { 
          let date = d3.max(d.values.map((v: any) => { return v.endDate; }))
          return this.xScale(moment(date));
        })
        .attr('x2', (d: any) => { 
      
          return this.xScale(moment());
        })
        .attr('y1', (d: any, i: number) => {
          return i*(2 + verticalPadding);
        })
        .attr('y2', (d: any, i: number) => {
          return i*(2 + verticalPadding);
        });

    let events = g.selectAll('event').data(this.data);
    
    events.enter()
          .append('line')
          .attr('class', 'event')
          .attr('stroke', (d: any) => { 
            let exiled = d.dateName.toLowerCase().includes('exil');
            return exiled ? '#ff0000' : '#b5b5b5'; 
          })//this.colors(d.key); })
          .attr('stroke-width', 8)
          .attr('stroke-linecap', 'round')
          .attr('x1', (d: any) => { return this.xScale(d.startDate.toDate()); })
          .attr('x2', (d: any) => { return this.xScale(d.endDate.toDate()); })
          .attr('y1', (d: any) => { return this.personHeightMap.get(d.person); })
          .attr('y2', (d: any) => { return this.personHeightMap.get(d.person); })
          .on('mouseover', (d: any) => {
            console.log(d);
            this.tooltip.nativeElement.style.opacity = '1';
            this.tooltip.nativeElement.style.top = `${d3.event.pageY}px`;
            this.tooltip.nativeElement.style.left = `${d3.event.pageX + 20}px`;
            this.tooltip.nativeElement.innerHTML = `
              <h2>${d.person}</h2>
              <h3>${d.dateName}</h3>
              <p>${moment(d.startDate).format('DD/MM/YYYY')} - ${moment(d.endDate).format('DD/MM/YYYY')}</p>
            `;
          })
          .on('mouseout', () => {
            this.tooltip.nativeElement.style.opacity = '0';
          });
  }

  createBrush(): void {
    let brushHeight = 40;
    let brushWidth = this.WIDTH;
    this.brushSVG = d3.select(this.brushContainer.nativeElement)
                      .append('svg')
                      .attr('width', brushWidth)
                      .attr('height', brushHeight);
    this.brushSVG.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0, 40)`)
    .call(
      d3.axisBottom(this.xScale)
        .ticks(d3.timeYear.every(5))
        .tickSize(20)
        .tickFormat((d: Date) => {
          return d3.timeFormat('%Y')(d);
        })
    )
    .selectAll('.tick');

    this.brush = d3.brushX()
                    .extent([[0, 0], [brushWidth, brushHeight]])
                    .on('end', this.brushEnd.bind(this));
    // brush
    this.brushSVG.append('g')
                    .attr('class', 'brush')
                    .attr('transform', `translate(0, 0)`)
                    .call(this.brush);
  }

  filterData(start: Date, end: Date): void {
    console.log(start, end);
  }

  highlightInMap(): void {

  }

  brushEnd(): void {
    if (!d3.event.sourceEvent || !d3.event.selection) return; // no selection or event

    let start = d3.event.selection.map(this.xScale.invert);
    let end = start.map(d3.timeYear.round);
    let brushDOM = d3.select('.brush');

    brushDOM.transition().call(d3.event.target.move, end.map(this.xScale));
    let range = d3.brushSelection((brushDOM as any).node());

    let startD = this.xScale.invert(+range[0]);
    let endD = this.xScale.invert(+range[1]);

    this.filterData(startD, endD);
  }

  createMap(): void {
    let options = {
      maxBounds: L.latLngBounds(L.latLng(48.121040, 16.183696), L.latLng(48.323600, 16.541306)),
      maxZoom: 18,
      minZoom: 11,
      zoom: 12,
      zoomControl: false,
      animate: true
    };


    this.map = L.map('map', options).setView([48.213939, 16.377285], 13);
    // this.map.invalidateSize();
    L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
      attribution: '', //'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
      id: 'mapbox.light', // mapbox://styles/velitchko/cjefo9eu118qd2rodaoq3cpj1
      accessToken: environment.MAPBOX_API_KEY,
      // layers: [this.markerLayerGroup, this.musicLayerGroup, this.heatmapLayerGroup, this.tagCloudLayerGroup]
    }).addTo(this.map);
  }



}
