import { Component, OnInit, Input, Inject, SimpleChanges, ComponentFactoryResolver, Injector, ApplicationRef, ComponentRef, AfterViewChecked, AfterViewInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { PLATFORM_ID } from '@angular/core';
import * as D3 from 'd3';
import { environment } from '../../../environments/environment';
import { Event } from '../../models/event';
import { MusicMapService } from '../../services/musicmap.service';
import { ModalDialogComponent } from '../modal/modal.component';
import { Geodata } from '../../models/location';
import { MapClusterTooltipComponent } from '../map-cluster-tooltip/map-cluster-tooltip.component';
import { DatabaseService } from '../../services/db.service';
import { ThemeService } from '../../services/theme.service';

declare var L: any;

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss']
})

export class MapComponent implements AfterViewInit {

  @Input() items: Event[];

  map: any;
  compRef: ComponentRef<any>;

  initialized: boolean = false;
  isBrowser: boolean;
  isMarkerSelected: boolean;
  mapLegendReady: boolean = false;
  routerPath: any;

  // layer groups
  markerLayerGroup: any;
  musicLayerGroup: any;
  heatmapLayerGroup: any;
  tagCloudLayerGroup: any;
  // marker groups
  markers: Array<any>; //all markers
  mainMarkerGroup: any; // main events
  temporaryMarkerGroup: any; // backbuffer with markers - we swap between mainMarkerGroup and temporaryMarkerGroup
  heatmapMarkerGroup: any; // holds our heatmap
  // observables

  currentEventInterval: Array<Date>;
  currentlySelectedEvents: Array<string>;
  currentlyHighlightedEvent: any;

  currentColorAssignment: Map<string, string>;
  selectedCluster: any;

  constructor(@Inject(PLATFORM_ID) private _platformId: Object,
    @Inject('WINDOW') private window: any,
    private mms: MusicMapService,
    public dialog: MatDialog,
    private resolver: ComponentFactoryResolver,
    private appRef: ApplicationRef,
    private injector: Injector,
    private db: DatabaseService,
    private ts: ThemeService,
    private http: HttpClient) {
    // have to check if we are client
    // else window is not defined errors
    this.isBrowser = isPlatformBrowser(this._platformId);

    if (this.isBrowser) {
      L = require('leaflet');
      // leaflet plugins automatically inject themselves and extend "L"
      require('leaflet.markercluster');   // clustering markers
      require('leaflet.polyline.snakeanim'); // animation for routing
      require('polyline-encoded'); // decoding polylines
      require('leaflet.heat'); // heatmap for leaflet
    }
    this.markers = new Array<any>();

    this.currentEventInterval = new Array<Date>();
    this.currentlySelectedEvents = new Array<any>();
    this.currentColorAssignment = new Map<string, string>();
  }

  ngAfterViewInit(): void {
    // only initiate map on browser side
    this.isMarkerSelected = false;
    if (this.isBrowser) {

      this.createMap();
      this.createMarkers();
      this.createHeatMap();

      // Event Selected 
      this.mms.currentlySelectedEvent.subscribe((ev: string) => {
        if (!ev) {
          this.map.removeLayer(this.mainMarkerGroup);
          this.map.removeLayer(this.musicLayerGroup);
          this.map.removeLayer(this.heatmapLayerGroup);
          this.map.removeLayer(this.tagCloudLayerGroup);
          this.map.removeLayer(this.temporaryMarkerGroup);

          this.temporaryMarkerGroup = L.featureGroup();

          this.map.addLayer(this.mainMarkerGroup);
          // we are good to set the isMarkerSelected to false now
          this.isMarkerSelected = false;
        }
        // should run once if a marker is clicked
        if (ev && !this.isMarkerSelected) {
          // if event is passed and we have a map
          // this means a marker was clicked to see details
          this.isMarkerSelected = true;

          this.map.removeLayer(this.mainMarkerGroup);
          this.map.removeLayer(this.musicLayerGroup);
          this.map.removeLayer(this.heatmapLayerGroup);
          this.map.removeLayer(this.tagCloudLayerGroup);

          this.createDetailMarkers(ev);
        }
      });

      // Event Highlighted
      this.mms.currentlyHighlightedItem.subscribe((highlight: any) => {
        this.currentlyHighlightedEvent = highlight;
        this.currentlyHighlightedEvent ? this.highlightMarkers() : this.unhighlightMarkers();
        // if its a singular item i.e. from timeline or something
        // just use the this.currentlyHighlightedEvent within the function
      });

      // comes from search
      this.mms.currentlySelectedEvents.subscribe((events: Array<any>) => {
        this.currentlySelectedEvents = events;
        this.currentlySelectedEvents ? this.highlightMarkers(this.currentlySelectedEvents) : this.unhighlightMarkers();
        // if there are multiple events pass the array to the 
        // following function for highlighting
      });

      // comes from timeline
      this.mms.currentEventInterval.subscribe((dates: Array<Date>) => {
        if (!dates) return;
        if (dates[0]) {
          this.currentEventInterval[0] = dates[0];
        }
        if (dates[1]) {
          this.currentEventInterval[1] = dates[1];
        }
        this.updateMarkers();
      });
    }
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
    this.map.invalidateSize();
    this.mainMarkerGroup = L.markerClusterGroup({ //https://github.com/Leaflet/Leaflet.markercluster#options
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: false,
      animate: true,
      animateAddingMarkers: true,
      //spiderfyDistanceMultiplier: 1.5,
      removeOutsideVisibleBounds: true,
      iconCreateFunction: (cluster: any) => {
        return L.divIcon({
          iconSize: [35, 35], // size of the icon
          className: 'cluster-map-marker',
          html: this.getSVGClusterIcon(cluster.getAllChildMarkers().length)
        });
      }
      //disableClusteringAtZoom: 17,
    });

    // setup groups
    this.temporaryMarkerGroup = L.layerGroup();

    this.mainMarkerGroup.on('clusterclick', this.handleClusterClick());
    this.mainMarkerGroup.on('clustermouseover', this.handleClusterMouseOver());
    this.mainMarkerGroup.on('clustermouseout', this.handleClusterMouseOut());

    // layer groups that contain marker/heatmap/tagcloud layers
    this.markerLayerGroup = L.layerGroup([this.mainMarkerGroup]);
    this.musicLayerGroup = L.layerGroup([]);
    this.heatmapLayerGroup = L.layerGroup([]);
    this.tagCloudLayerGroup = L.layerGroup([]);

    // control layers for map
    let baseLayers = {
      '<span class=\"layer-control-item\">Event markers</span>': this.markerLayerGroup,
      '<span class=\"layer-control-item\">Music markers</span>': this.musicLayerGroup,
      '<span class=\"layer-control-item\">Heatmap</span>': this.heatmapLayerGroup,
      '<span class=\"layer-control-item\">Tagcloud</span>': this.tagCloudLayerGroup,
    };
    this.markerLayerGroup.addTo(this.map);
    // add tiles
    // https://api.mapbox.com/styles/v1/velitchko/cjefo9eu118qd2rodaoq3cpj1/tiles/256/{z}/{x}/{y}?access_token={accessToken}
    L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
      attribution: '', //'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
      id: 'mapbox.light', // mapbox://styles/velitchko/cjefo9eu118qd2rodaoq3cpj1
      accessToken: environment.MAPBOX_API_KEY,
      layers: [this.markerLayerGroup, this.musicLayerGroup, this.heatmapLayerGroup, this.tagCloudLayerGroup]
    }).addTo(this.map);

    // add control for layers to the map
    L.control.layers(null, baseLayers, { position: 'bottomright' }).addTo(this.map);

    this.map.on('popupopen', this.handlePopUpOpen.bind(this));
    this.map.on('click', this.handleMapClick.bind(this));
    this.map.on('popupclose', this.handlePopUpClose.bind(this));
    this.map.on('zoomend', () => { this.mainMarkerGroup.refreshClusters(); });

    this.initialized = true;
  }

  /**
   * Returns the event with corresponding objectId
   * @param objectId - the record id of the event
   * @return the event we found with that record id
   */
  findEvent(objectId: string): Event {
    return this.items.find((e: Event) => { return objectId === e.objectId; });
  }

  /**
   * Opens a modal (dialog)
   * @param e - event with data that we will display in the modal
   */
  openDialog(e: Event): void {
    if (!e) return;
    let dialogRef = this.dialog.open(ModalDialogComponent, {
      width: '50%',
      data: e
    });
    dialogRef.afterClosed().subscribe((result: any) => { });
  }

  unhighlightMarkers(): void {
    this.mainMarkerGroup.eachLayer((layer: any) => {
      if (layer._icon) L.DomUtil.removeClass(layer._icon, 'selected');
    });

  }

  resetMapMarkers(): void {
    this.map.removeLayer(this.temporaryMarkerGroup);
    this.map.addLayer(this.mainMarkerGroup);
  }

  /**
   * Highlights mapmarkers that were found from the objectIdArr
   * @param events - array of objectId's (number) (OPTIONAL)
   * @param fromMap     - boolean if called from map
   */
  highlightMarkers(events?: Array<string>): void {
    if (!events) {
      // if no events array provided we are looking for only one item
      this.mainMarkerGroup.eachLayer((layer: any) => {
        if (layer._icon) L.DomUtil.removeClass(layer._icon, 'selected');
        if (layer.objectId === this.currentlyHighlightedEvent) {
          if (layer._icon) {
            // single marker
            L.DomUtil.addClass(layer._icon, 'selected');
            return;
          } else {
            // cluster
            let cluster = this.mainMarkerGroup.getVisibleParent(layer);
            if (cluster) {
              cluster.spiderfy();
              cluster.getAllChildMarkers().forEach((child: any) => {
                if (child._icon) L.DomUtil.removeClass(child._icon, 'selected');
                if (child.objectId === this.currentlyHighlightedEvent) {
                  if (child._icon) {
                    L.DomUtil.addClass(child._icon, 'selected');
                    return;
                  }
                }
              });
            }
          }
        }
      });
    } else {
      if (events.length === 0) return;
      events.forEach((event: string) => {
        this.mainMarkerGroup.eachLayer((layer: any) => {
          if (layer.objectId === event) {
            this.temporaryMarkerGroup.addLayer(layer);
          }
        });
      });
      this.map.removeLayer(this.mainMarkerGroup);
      this.map.addLayer(this.temporaryMarkerGroup);
    }
  }

  /**
   * Updates the map markers currently in the this.currentEventInterval
   * Sets map marker opacity to 0 if it is out of view and 0.75 if it is in view
   */
  updateMarkers(): void {
    if (!this.initialized) return;
    let markersInInterval = new Array<any>();
    for (let m of this.markers) {
      if (this.mms.checkIfInInterval(this.currentEventInterval[0], this.currentEventInterval[1], m.startDate, m.endDate)) {
        this.mainMarkerGroup.addLayer(m);
        markersInInterval.push(m); // for the heatmap
      } else {
        this.mainMarkerGroup.removeLayer(m);
      }
    }
    // update heatmap
    this.createHeatMap(markersInInterval);
  }

  /**
   * Handles mouseclick events on the map
   * @return function void - the mouseclick handler function
   */
  handleMapClick(): (e: any) => void {
    return (e: any) => {
      this.mms.setHighlight(null);
    }
  }

  /**
   * Handles mouse click on a cluster of  events
   * @return function void - the mouse click handler function
   */
  handleClusterClick(): (e: any) => void {
    return (e: any) => {
      e.originalEvent.preventDefault();
      e.layer.spiderfy();
      //e.target.getLayers()); <- gives us all markers?
      // TODO need to find which are not in current cluster and lower their opacity or gray them out
    }
  }

  /**
   * Handles mouseout on a cluster of events
   * @return function void - the mouseout handler function
   */
  handleClusterMouseOut(): (e: any) => void {
    return (e: any) => {
      e.originalEvent.preventDefault();
    }
  }

  /**
   * Handles mouseover on a cluster of events
   * @return function void - the mouseover handler function
   */
  handleClusterMouseOver(): (e: any) => void {
    return (e: any) => {
      let markers = e.layer.getAllChildMarkers();

      let events = new Array<Event>();
      markers.forEach((m: any) => {
        let event = this.findEvent(m.objectId);
        events.push(event);
      });
      // destroy previous component if any
      if (this.compRef) {
        this.compRef.destroy();
      }
      // dynamically create new component and pass input data
      const compFactory = this.resolver.resolveComponentFactory(MapClusterTooltipComponent);
      this.compRef = compFactory.create(this.injector)
      this.compRef.instance.events = events;

      // create container and add to leaflet popup
      let div = document.createElement('div');
      div.appendChild(this.compRef.location.nativeElement);
      let popup = L.popup({ autoPan: false, className: 'cluster-marker-tooltip' })
        .setContent(div); //div
      e.layer.bindPopup(popup).openPopup();

      // attach component
      if (this.appRef.attachView) {
        this.appRef.attachView(this.compRef.hostView);
        this.compRef.onDestroy(() => {
          this.appRef.detachView(this.compRef.hostView);
          e.layer.closePopup();
        });
      }
    }
  }

  /**
   * Handles mouseover events
   * @return function void - the mouseover handler function
   */
  handleMouseOver(): (e: any) => void {
    return (e: any) => {
      e.target.openPopup();
      this.mms.setHighlight(e.target.objectId);
    }
  }

  handleMouseOut(): (e: any) => void {
    return (e: any) => {
      e.target.closePopup();
      this.mms.setHighlight(null);
    }
  }

  /**
   * Handles mouse click events
   * @return function void - the mouse click handler function
   */
  handleClick(): (e: any) => void {
    return (e: any) => {
      this.mms.setSelectedEvent(e.target.objectId);
    }
  }

  /**
   * Creates a detail view of an events locations
   * @param event - the clicked or selected event
   */
  createDetailMarkers(id: string): void {
    let event = this.db.getEventById(id);

    let markerIcon = L.divIcon({
      iconSize: [25, 25], // size of the icon
      className: 'default-map-marker',
      html: this.getSVGIcon(),
    });

    // create new markers for every geodata point we have
    let tempMarkers = new Array<any>();
    let wayPoints = new Array<any>();
    // MAIN LOCATION
    if (event.geodata) {
      let mainPopup = L.popup({ autoPan: false, autoClose: false }) // could be better solution for this -> issue is when mo a marker that is @ boundary map moves which closes marker which moves map which opens marker etc.
        .setContent(event.geodata.streetName + (event.geodata.streetNumber ? ' ' + event.geodata.streetNumber : '') + (event.geodata.districtNumber ? ' ' + event.geodata.districtNumber : ''));
      let mainMarker = L.marker([+event.geodata.lat, +event.geodata.lng], { icon: markerIcon })
        .bindPopup(mainPopup).openPopup();
      mainMarker.objectId = event.objectId;
      //marker._icon = markerIcon;
      mainMarker.name = event.name;
      mainMarker.fromSearch = false;
      mainMarker.startDate = event.startDate;
      mainMarker.endDate = event.endDate ? event.endDate : event.startDate;
      mainMarker.setOpacity(0.75);
      mainMarker.themes = event.themes; // need to add this so our cluster icon can compute the donut chart
      tempMarkers.push(mainMarker);
      wayPoints.push({
        lat: +event.geodata.lat,
        lng: +event.geodata.lng
      });
    }
    // ROUTES
    event.routes.forEach((gArr: Array<Geodata>) => {
      gArr.forEach((g: Geodata) => {
        if (g.lat && g.lng) {
          let popup = L.popup({ autoPan: false, autoClose: false }) // could be better solution for this -> issue is when mo a marker that is @ boundary map moves which closes marker which moves map which opens marker etc.
            .setContent(g.streetName + (g.streetNumber ? ' ' + g.streetNumber : '') + (g.districtNumber ? ' ' + g.districtNumber : ''));
          let marker = L.marker([+g.lat, +g.lng], { icon: markerIcon })
            .bindPopup(popup).openPopup();
          marker.objectId = event.objectId;
          //marker._icon = markerIcon;
          marker.name = event.name;
          marker.fromSearch = false;
          marker.startDate = event.startDate;
          marker.endDate = event.endDate ? event.endDate : event.startDate;
          marker.setOpacity(0.75);
          marker.themes = event.themes; // need to add this so our cluster icon can compute the donut chart
          tempMarkers.push(marker);
          wayPoints.push({
            lat: +g.lat,
            lng: +g.lng
          });
        }
      });
    });
    this.temporaryMarkerGroup = L.featureGroup(tempMarkers);
    this.temporaryMarkerGroup.addTo(this.map);

    console.log(wayPoints);
    // can only construct path if at least 2 waypoints
    if (wayPoints.length >= 2) {
      this.constructPath(wayPoints);
    }
  }

  /**
   * Constructs a polyline path through the defined waypoints and animates it
   * @param wayPoints - array of waypoints with latitude and longitude
   */
  constructPath(wayPoints: Array<any>): void {
    let url = 'https://api.mapbox.com/directions/v5/mapbox/walking/'; // base url

    wayPoints.forEach((w: any, idx: number) => {
      url += w.lng + ',' + w.lat; // append lat lng as semi-colon seperated list to the base url
      if (idx < wayPoints.length - 1) {
        url += ';';
      }
    });

    // get polyline from mapbox add to map and trigger animation
    this.http.get(`${url}?access_token=${environment.MAPBOX_API_KEY}`).subscribe(
      (success: any) => {
        this.routerPath = L.Polyline.fromEncoded(success.routes[0].geometry, { snakingSpeed: 100 }); // animation speed is 100px/s
        this.map.addLayer(this.routerPath);
        this.map.flyToBounds(this.routerPath.getBounds());
        this.routerPath.snakeIn();
      },
      (error: any) => {
        console.log('error');
        console.log(error);
      }
    );
  }

  /**
   * PopupOpen event handler when map marker has been clicked and opens a tooltip
   * @return function void - tooltip popup open handler
   */
  handlePopUpOpen(): (e: any) => void {
    return (e: any) => {
      L.DomUtil.addClass(e.popup._source._icon, 'selected');
    };
  }

  /**
   * PopupClose event handler when map marker tooltip has been closed
   * @return function void - tooltip popup close handler
   */
  handlePopUpClose(): (e: any) => void {
    return (e: any) => {
      if (e.popup._source._icon) {
        L.DomUtil.removeClass(e.popup._source._icon, 'selected');
      }
    };
  }

  /**
   * Returns HTML tooltip for an event as string
   * @param e       - event
   * @return string - tooltip HTML as string
   */
  getHTMLTooltip(e: Event): string {
    // <i class=\"material-icons\">face</i>${e.people.length}
    return `<div class=\"tooltip\">
    <h3>${e.name}</h3>
    ${this.mms.prettyPrintDate(e.startDate, false)}${this.mms.prettyPrintDate(e.endDate, true)}
    <p>
      
      <i class=\"material-icons\">domain</i>${e.peopleOrganizations.length}
      <i class=\"material-icons\">location_on</i>${e.locations.length}
      <i class=\"material-icons\">event</i>${e.events.length}
      <i class=\"material-icons\">collections</i>${e.sources.length}
      <i class=\"material-icons\">donut_large</i>${e.themes.length}
    </p>
    <p>Click for more info...</p>
    `;
  }

  /**
   * Generates an SVG donut chart showing the distribution of themes
   * @param themeMap          - our map of themes <string,number>
   * @param childClusterCount - number of children in the cluster (default = 0)
   * @param cssClass          - css class to be added to the SVG
   * @return string           - the SVG as string
   */
  getSVGClusterIcon(childClusterCount: number = 0, cssClass: string = ''): string {
    // add tooltip
    let data = new Array<any>();
    let width = 35; // in pixels
    let height = 35; // in pixels
    let thickness = 7; // in pixels

    let radius = Math.min(width, height) / 2;

    let svg = D3.select('body').append('svg')
      .remove() // remove it after creating so we can create the icon and then return the HTML as a string to L
      .attr('class', 'custom-cluster-icon')
      .attr('width', width)
      .attr('height', height)

    let g = svg.append('g')
      .attr('transform', 'translate(' + (width / 2) + ',' + (height / 2) + ')');
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
      .attr("fill", "#F1F1F1");

    let arc = D3.arc()
      .innerRadius(radius - thickness)
      .outerRadius(radius);

    let pie = D3.pie();
    let values = data.map(m => { return m[1]; });

    let path = g.selectAll('path')
      .data(pie(values))
      .enter()
      .append('g')
      .append('path')
      .attr('d', <any>arc)
      .attr('fill', (d, i) => {
        return this.currentColorAssignment.get(data[i][0]);
      })
      .transition()
      .delay((d, i) => { return i * 500; })
      .duration(500)
      .attrTween('d', (d: any) => {
        var i = D3.interpolate(d.startAngle + 0.1, d.endAngle);
        return function (t: any) {
          d.endAngle = i(t);
          return arc(d);
        }
      });
    if (childClusterCount) {
      g.append('text')
        .text(childClusterCount)
        .attr('text-anchor', 'middle')
        .attr('fill', '#5a5a5a')
        .attr('dy', '.35em');
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" class="${cssClass}" viewBox="0 0 35 35">${svg.html()}</svg>`;
  }

  /**
   * Returns svg map marker as string
   * @return string - SVG of a marker as string
   */
  getSVGIcon(color?: string): string {
    let svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 25">
        <circle cx="10" cy="10" r="10" fill="${color ? color : 'black'}">
      </svg>
    `;
    return svg;
  }

  getMarkerIcon(event: Event): any {
    // black magic .toString() to avoid typescript complaints
    let color: string;
    event.themes.forEach((t: any) => {
      if (this.ts.isMainTheme(t.theme)) {
        color = this.ts.getColorForTheme(t.theme);
      }
    });

    let markerIcon = L.divIcon({
      iconSize: [25, 25], // size of the icon
      className: 'default-map-marker',
      html: this.getSVGIcon(color), // cast to string
    });

    return markerIcon;
  }

  /**
   * Creates map markers for every event that has a location
   * @param events (optional) - array of events
   */
  createMarkers(events?: Array<Event>): void {
    let eventCollection = events ? events : this.items;
    for (let i of eventCollection) {
      let g = i.geodata;
      if (g && (g.lat && g.lng)) {

        let popup = L.popup({ autoPan: false, className: 'default-map-marker' }) // could be better solution for this -> issue is when mo a marker that is @ boundary map moves which closes marker which moves map which opens marker etc.
          .setContent(this.getHTMLTooltip(i));

        let marker = L.marker([g.lat, g.lng], { icon: this.getMarkerIcon(i) })
          .on('click', this.handleClick())
          .on('mouseover', this.handleMouseOver())
          .on('mouseout', this.handleMouseOut())
          .bindPopup(popup);

        marker.objectId = i.objectId;
        marker.name = i.name;
        marker.fromSearch = false;
        marker.startDate = i.startDate;
        marker.endDate = i.endDate ? i.endDate : i.startDate;
        // marker.setOpacity(0.75);
        // marker.themes = i.themes; // need to add this so our cluster icon can compute the donut chart
        this.markers.push(marker);
        this.mainMarkerGroup.addLayer(marker);
      }
    }
    this.mainMarkerGroup.addTo(this.map);
  }

  /**
   * Creats a heatmap for a set of markers
   * @param markers (optional)  - array of markers with lat, lng properties
   */
  createHeatMap(markers?: Array<any>): void {
    let latLngs = new Array<any>();
    let mArr = markers ? markers : this.markers;

    for (let m of mArr) {
      latLngs.push([m.getLatLng().lat, m.getLatLng().lng]);
    }
    // create new heatmap
    if (!this.heatmapMarkerGroup) {
      this.heatmapMarkerGroup = L.heatLayer(latLngs);
      //this.heatmapMarkerGroup.addTo(this.map);
      this.heatmapLayerGroup.addLayer(this.heatmapMarkerGroup);
    } else {
      // update heatmap
      this.heatmapMarkerGroup.setLatLngs(latLngs);
    }
  }
}
