import { Component, OnInit, Inject, Input, AfterViewInit, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';
import { Geodata } from '../../models/location';

declare var L: any;

@Component({
  selector: 'app-minimap',
  templateUrl: './minimap.component.html',
  styleUrls: [ './minimap.component.scss' ]
})
export class MiniMapComponent implements AfterViewInit {
  @Input() location: Geodata;
  map: any;
  isBrowser: boolean;
  markers: Array<any>;

  constructor(@Inject(PLATFORM_ID) private _platformId: Object) {
    // have to check if we are client
    // else window is not defined errors
    this.isBrowser = isPlatformBrowser(this._platformId);
    if(this.isBrowser) {
      L = require('leaflet');
    }
    this.markers = new Array<any>();
  }

  ngAfterViewInit(): void {
    // only initiate map on browser side
    if(this.isBrowser) {
      let options = {
        maxBounds: L.latLngBounds(L.latLng(48.121040, 16.183696), L.latLng(48.323600, 16.541306)),
        maxZoom: 18,
        minZoom: 11,
        zoom: 12,
        zoomControl: false
      };
      this.map = L.map('minimap', options).setView([48.2060778, 16.3674187], 12);
      L.control.zoom({position: 'topright'}).addTo(this.map);
      L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
        attribution: '', //'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
        id: 'mapbox.light', // mapbox://styles/velitchko/cjefo9eu118qd2rodaoq3cpj1
        accessToken: environment.MAPBOX_API_KEY
        }).addTo(this.map);

      this.calculateBounds();
      this.createMarkers();
      }
  }


  /**
   * Computes the bounds of the locations in the locations array
   * and centers the minimap based on the bounds
   */
  calculateBounds(): any {
    if(!this.location || !(this.location.lat && this.location.lng)) return;
    let point = L.latLng(+this.location.lat, +this.location.lng);
    let bounds = point.toBounds(500);
    this.map.fitBounds(bounds);
  }

  /**
   * Returns svg map marker as string
   */
  getSVGIcon(): string {
    let svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 25">
        <path d="M23.2,6.3A12.3,12.3,0,0,0,18.7,1.81,12.08,12.08,0,0,0,12.5.15,12.08,12.08,0,0,0,6.3,1.81,12.3,12.3,0,0,0,1.81,6.3,12.08,12.08,0,0,0,.15,12.5a12.08,12.08,0,0,0,1.66,6.2,12.3,12.3,0,0,0,4.5,4.49,12.08,12.08,0,0,0,6.2,1.66,12.08,12.08,0,0,0,6.2-1.66,12.3,12.3,0,0,0,4.49-4.49,12.08,12.08,0,0,0,1.66-6.2A12.08,12.08,0,0,0,23.2,6.3Z"/>
      </svg>
    `;
    return svg;
  }
  
  /**
   * Creates map markers for every event that has a location
   */
  createMarkers(): void {
    if(!this.location || !(this.location.lat && this.location.lng)) return; // no coordinates
    let markerIcon = L.divIcon({
         iconSize: [25, 25], // size of the icon
         className: 'default-map-marker',
         html: this.getSVGIcon(),
    });
    
    let popup = L.popup().setContent(this.location.streetName);
    let marker = L.marker([+this.location.lat, +this.location.lng], { icon: markerIcon })
                  .bindPopup(popup, {className: 'minimap'})
                  .addTo(this.map);
    this.markers.push(marker);
  }
}
