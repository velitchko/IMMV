import { Component, OnInit, Input, Inject, OnChanges, SimpleChanges, ComponentFactoryResolver, Injector, ApplicationRef, ComponentRef, AfterViewChecked, AfterViewInit } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Event } from '../../models/event';
import { MusicMapService } from '../../services/musicmap.service';
import { ModalDialogComponent } from '../modal/modal.component';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { Geodata } from '../../models/location';
import { MapClusterTooltipComponent } from '../map-cluster-tooltip/map-cluster-tooltip.component';
import * as D3 from 'd3';
import { DatabaseService } from 'src/app/services/db.service';

declare var L: any;
declare var d3: any;

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss']
})

export class MapComponent implements OnChanges {

  @Input() items: Event[];

  map: any;
  compRef: ComponentRef<any>;

  initialized: boolean = false;
  isBrowser: boolean;
  isMarkerSelected: boolean;
  mapLegendReady: boolean = false;
  routerPath: any;
  MAX_TRIES: number = 6; // max number of iterations for generating the tag cloud

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
  currentlySelectedItems: Array<any>;
  currentlyHighlightedItem: any;
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
    this.currentlySelectedItems = new Array<any>();
    this.currentColorAssignment = new Map<string, string>();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes) {
      // only initiate map on browser side
      this.isMarkerSelected = false;
      if (this.isBrowser) {
        this.mms.currentlySelectedEvent.subscribe((ev: Event) => {
          if (!ev && this.map) {
            // null means we have no selected event so we can swap groups
            this.map.eachLayer((layer: any) => {
              if (!layer._url) { // _url means that this layer has tiles
                this.map.removeLayer(layer);
              }
            });
            this.map.addLayer(this.mainMarkerGroup);
            this.markerLayerGroup.addTo(this.map); // show it shows up as checked in the layer control
            // we are good to set the isMarkerSelected to false now
            this.isMarkerSelected = false;
          }
          // should run once if a marker is clicked
          if (ev && this.map && !this.isMarkerSelected) {
            // if event is passed and we have a map
            // this means a marker was clicked to see details
            this.isMarkerSelected = true;
            this.map.removeLayer(this.mainMarkerGroup);
            this.createDetailMarkers(ev);
          }
        });

        this.mms.currentColorAssignment.subscribe((colorMap: Map<string, string>) => {
          if (!colorMap) return;
          this.currentColorAssignment = colorMap;
          if (this.currentColorAssignment.size > 0) {
            this.mapLegendReady = true;
          }
        });

        this.mms.currentSectionSizes.subscribe((sizes: Array<number>) => {
          // resize map to 100% w/h of parent container (defined in css)
          if (this.map) {
            this.map.invalidateSize();
          }
        });

        // from timeline (mouseover on events)
        this.mms.currentlyHighlightedItem.subscribe((highlight: any) => {
          this.currentlyHighlightedItem = highlight;
          if (this.map) {
            this.highlightMarkers([this.currentlyHighlightedItem.idx], this.currentlyHighlightedItem.fromMap);
          }
        });

        // comes from search
        this.mms.currentlySelectedItems.subscribe((objectIdArr: Array<any>) => {
          this.currentlySelectedItems = objectIdArr;
          if (this.map) {
            this.highlightMarkers(this.currentlySelectedItems, false);
          }
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

        this.createMap();
      }
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
        let themes = this.calculateDistributionPerCluster(cluster);
        return L.divIcon({
          iconSize: [35, 35], // size of the icon
          className: 'cluster-map-marker',
          themes: themes,
          html: this.getSVGClusterIcon(themes, cluster.getAllChildMarkers().length)
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
    this.musicLayerGroup = L.layerGroup([]);;
    this.heatmapLayerGroup = L.layerGroup([]);;
    this.tagCloudLayerGroup = L.layerGroup([]);;
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
    this.map.on('popupopen', this.handlePopUpOpen());
    this.map.on('click', this.handleMapClick());
    this.map.on('popupclose', this.handlePopUpClose());
    this.map.on('zoomend', () => {
      this.mainMarkerGroup.refreshClusters();
    })
    this.initialized = true;
    // this.items = this.es.getEvents();
    this.createMarkers();
    this.createHeatMap();
    this.createTagCloudMap();
  }

  /**
   * Returns the event with corresponding objectId
   * @param objectId - the record id of the event
   * @return the event we found with that record id
   */
  findEvent(objectId: string): Event {
    // console.log(`looking for ${objectId}`)
    let foundEvent = this.items.filter((e: Event) => {
      if (objectId === e.objectId) {
        return e;
      }
    });
    return foundEvent[0];
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
    dialogRef.afterClosed().subscribe((result) => {
      //console.log(result);
    });
  }

  /**
   * Highlights mapmarkers that were found from the objectIdArr
   * @param objectIdArr - array of objectId's (number)
   * @param fromMap     - boolean if called from map
   */
  highlightMarkers(objectIdArr: Array<any>, fromMap: boolean): void {
    // TODO rethink this
    if (fromMap) return;
    if (!objectIdArr[0]) {
      for (let m of this.markers) {
        m.closePopup();
      }
      // TODO unspiderfy like the code below
    } else {
      for (let id of objectIdArr) {
        this.mainMarkerGroup.eachLayer((layer: any) => {
          if (layer.objectId === id) {
            //this.map.flyTo(layer.getLatLng()); -> causes closing and opening of tooltip need better solution
            this.selectedCluster = this.mainMarkerGroup.getVisibleParent(layer);
            if (this.selectedCluster && this.selectedCluster._markers) {
              this.selectedCluster.spiderfy();
            }
            if (!fromMap) {
              layer.openPopup();
              //this.mainMarkerGroup.zoomToShowLayer(layer);
            }
          }
        });
      }
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
      this.mms.setHighlight({ idx: null, fromMap: true });
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
      // console.log(e.layer.getAllChildMarkers());
    }
  }

  /**
   * Handles mouseout on a cluster of events
   * @return function void - the mouseout handler function
   */
  handleClusterMouseOut(): (e: any) => void {
    return (e: any) => {
      e.originalEvent.preventDefault();
      //e.layer.closePopup();
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
      for (let m of this.markers) {
        if (m.objectId === e.target.objectId) {
          m.openPopup();
          this.mms.setHighlight({ idx: m.objectId, fromMap: true });
        }
      }
    }
  }

  handleMouseOut(): (e: any) => void {
    return (e: any) => {
    }
  }

  /**
   * Handles mouse click events
   * @return function void - the mouse click handler function
   */
  handleClick(): (e: any) => void {
    return (e: any) => {
      let event = this.findEvent(e.target.objectId); // event we have clicked
      this.db.getAsEvent(event).then((success) => {
        console.log(success);
        this.mms.setSelectedEvent(success);
      });
    }
  }

  /**
   * Creates a detail view of an events locations
   * @param event - the clicked or selected event
   */
  createDetailMarkers(event: Event): void {
    console.log('creating paths');
    let markerIcon = L.divIcon({
      iconSize: [25, 25], // size of the icon
      className: 'default-map-marker',
      html: this.getSVGIcon(),
    });

    // create new markers for every geodata point we have
    let tempMarkers = new Array<any>();
    let wayPoints = new Array<any>();
    // MAIN LOCATION
    if(event.geodata) {
      let mainPopup = L.popup({ autoPan: false, autoClose: false }) // could be better solution for this -> issue is when mo a marker that is @ boundary map moves which closes marker which moves map which opens marker etc.
        .setContent(event.geodata.streetName + (event.geodata.streetNumber ? ' ' + event.geodata.streetNumber : '') + (event.geodata.districtNumber ? ' ' + event.geodata.districtNumber : ''));
      let mainMarker = L.marker([+event.geodata.lat, +event.geodata.lng], { icon: markerIcon })
        .bindPopup(mainPopup).openPopup();
      mainMarker.objectId = event.objectId;
      //marker._icon = markerIcon;
      mainMarker.name = event.name;
      mainMarker.fromSearch = false;
      mainMarker.startDate = event.startDate;
      mainMarker.endDate = event.endDate;
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
          marker.endDate = event.endDate;
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
   * Computes the distribution of themes for a given cluster in the map
   * @param cluster             - cluster that we get from leaflet-marker-cluster
   * @return map<string,number> - a map of themes with their associated count
   */
  calculateDistributionPerCluster(cluster: any): Map<string, number> {
    let childMarkers = cluster.getAllChildMarkers();
    let themeMap = new Map<string, number>();
    for (let c of childMarkers) {
      for (let t of c.themes) {
        themeMap.set(t.name, themeMap.get(t.name) ? themeMap.get(t.name) + 1 : 1);
      }
    }
    return themeMap;
  }

  /**
   * Generates an SVG donut chart showing the distribution of themes
   * @param themeMap          - our map of themes <string,number>
   * @param childClusterCount - number of children in the cluster (default = 0)
   * @param cssClass          - css class to be added to the SVG
   * @return string           - the SVG as string
   */
  getSVGClusterIcon(themeMap: Map<string, number>, childClusterCount: number = 0, cssClass: string = ''): string {
    // add tooltip
    let data = Array.from(themeMap);
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
   * @param events (optional) - array of events
   */
  createMarkers(events?: Array<Event>): void {
    let markerIcon = L.divIcon({
      iconSize: [25, 25], // size of the icon
      className: 'default-map-marker',
      html: this.getSVGIcon(),
    });
    let eventCollection = events ? events : this.items;
    for (let i of eventCollection) {
      let g = i.geodata;
      if (g && (g.lat && g.lng)) {
        let popup = L.popup({ autoPan: false, className: 'single-marker-tooltip' }) // could be better solution for this -> issue is when mo a marker that is @ boundary map moves which closes marker which moves map which opens marker etc.
          .setContent(this.getHTMLTooltip(i));
        let marker = L.marker([g.lat, g.lng], { icon: markerIcon })
          .on('click', this.handleClick())
          .on('mouseover', this.handleMouseOver())
          .bindPopup(popup)
        marker.objectId = i.objectId;
        //marker._icon = markerIcon;
        marker.name = i.name;
        marker.fromSearch = false;
        marker.startDate =i.startDate;
        marker.endDate = i.endDate;
        marker.setOpacity(0.75);
        marker.themes = i.themes; // need to add this so our cluster icon can compute the donut chart
        this.markers.push(marker);
        this.mainMarkerGroup.addLayer(marker);
      }
    }
    this.mainMarkerGroup.addTo(this.map);
  }

  /**
   * Computes the distribution of themes for a given cluster in the map
   * @param cluster             - cluster that we get from leaflet-marker-cluster
   * @return map<string,number> - a map of themes with their associated count
   */
  getThemeMap(events: Array<Event>): Map<string, number> {
    let themeMap = new Map<string, number>();
    for (let e of events) {
      for (let t of e.themes) {
        themeMap.set(t.theme.name, themeMap.get(t.theme.name) ? themeMap.get(t.theme.name) + 1 : 1);
      }
    }
    return themeMap;
  }

  //   /**
  //    *
  //    */
  //   checkIfKeyExists(map: Map<Geodata, Array<Event>>, objectKey: string): boolean {
  //     let found = false;
  //     map.forEach( (value: Array<Event>, key: Geodata) => {
  //       if(key.streetName === objectKey) {
  //         found = true;
  //       }
  //     });
  //     return found;
  //   }

  //   /**
  //    *
  //    */
  //   getValueByKey(map: Map<Geodata, Array<Event>>, objectKey: string): Array<Event> {
  //     let result: Array<Event>;
  //     map.forEach( (value: Array<Event>, key: Geodata) => {
  //       if(key.streetName === objectKey) {
  //         result = value;
  //       }
  //     });
  //     return result;
  //   }

  /**
   * Creats a georeferenced wordcloud on the map
   * @param markers (optional)  - array of markers with lat, lng properties
   */
  createTagCloudMap(markers?: Array<any>): void {
    // let mArr = markers? markers : this.markers;
    // let locationMap = new Map<Geodata, Array<Event>>();
    // mArr.forEach( (m: any) => {
    //     let e = this.findEvent(+m.objectId);
    //     for(let g of e.geodata) {
    //       if(!this.checkIfKeyExists(locationMap, g.streetName)) {
    //         // location doesnt exist in the map
    //         // create array of events push event to it
    //         // add it to the map
    //         let tempArr = new Array<Event>();
    //         tempArr.push(e);
    //         locationMap.set(g, tempArr);
    //       } else {
    //         //console.log('exists appending entry');
    //         // location exists in map append event to the list
    //         let foundVal = this.getValueByKey(locationMap, g.streetName);
    //         foundVal.push(e);
    //       }
    //     }
    // });

    // let locationThemeMap = new Map<Geodata, Map<string,number>>();
    // locationMap.forEach( (value: Array<Event>, key: Geodata) => {
    //   let themeMap = this.getThemeMap(value);
    //   locationThemeMap.set(key, themeMap);
    // });

    // let locationSVGMap = new Map<Geodata, string>();

    // locationThemeMap.forEach( (value: Map<string,number>, key: Geodata) => {
    //   locationSVGMap.set(key, this.createTagCloud(value));
    // });
  }

  /**
   *
   */
  createTagCloud(themeMap: Map<string, number>): string {
    let width = '200';
    let height = '200';

    let div = document.createElement('div');
    let hostEl = D3.select(div);

    let svg = hostEl.append('svg')
      .remove()
      .attr('width', width)
      .attr('height', height)

    let viewBox = [0, 0, width, height].join(" ");
    svg.attr("viewBox", viewBox);
    let themesToDraw = new Array<any>();
    themeMap.forEach((value: number, key: string) => {
      themesToDraw.push({ text: key, size: value * 4 });
    })
    this.generateTagCloud(themesToDraw, svg, { width: width, height: height });

    return hostEl.html();
  }

  /**
   *
   */
  generateTagCloud(themesToDraw: Array<any>, svg: any, dimensions: any, retryCycle?: number): void {
    d3.layout.cloud()
      .size([dimensions.width, dimensions.height])
      .words(themesToDraw)
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
        if (themeArr.length == themesToDraw.length) {
          this.drawTagCloud(themeArr, svg, dimensions); // finished
        }
        else if (!retryCycle || retryCycle < this.MAX_TRIES) {
          // words are missing due to the random placement and limited room space
          // try again and start counting retries
          this.generateTagCloud(themesToDraw, svg, (retryCycle || 1) + 1);
        } else {
          // retries maxed and failed to fit all the words
          this.drawTagCloud(themeArr, svg, dimensions);
        }
      })
      .start();
  }

  /**
   *
   */
  drawTagCloud(words: Array<any>, svg: any, dimensions: any): void {
    let g = svg.append('g')
      .attr('transform', 'translate(0,0)');

    let wordcloud = g.append("g")
      .attr('class', 'wordcloud')
      .attr("transform", "translate(" + dimensions.width / 2 + "," + dimensions.height / 2 + ")");

    wordcloud.selectAll('text')
      .data(words)
      .enter().append('text')
      .attr('class', 'word')
      .style('fill', (d: any, i: any) => {
        return this.mms.getColorAssignmentForCategory(d.text);
        //return this.fill(i);
      })
      .style('font-size', (d: any) => { return d.size + 'px'; })
      .attr("text-anchor", "middle")
      .attr("transform", (d: any) => { return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")"; })
      .text((d: any) => { return d.text; });
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
