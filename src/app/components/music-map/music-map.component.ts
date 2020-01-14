import { Component, AfterViewInit, ViewChild } from '@angular/core';
import { Event } from '../../models/event';
import { HistoricEvent } from '../../models/historic.event';
import { MapComponent } from '../map/map.component';
import { TimelineComponent } from '../timeline/timeline.component';
import { ModalDialogComponent } from '../modal/modal.component';
import { SearchComponent } from '../search/search.component';
import { MusicMapService } from '../../services/musicmap.service';
import { MapValuesPipe } from '../../pipes/map.pipe/map.pipe';
import { DatabaseService } from '../../services/db.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-music-map',
  templateUrl: './music-map.component.html',
  styleUrls: [ './music-map.component.scss' ]
})

export class MusicMapComponent implements AfterViewInit {
  @ViewChild('themedrawer') themedrawer: any;
  @ViewChild('previewdrawer') previewdrawer: any;

  events: Array<Event>;
  historicEvents: Array<HistoricEvent>;

  loading = true;
  
  selectedStartDate: Date;
  selectedEndDate: Date;
  currentEventInterval: Array<Date>;
  
  direction: string;
  showTLOptions: boolean = false;
  
  resultMap: Map<string, number>;
  
  currentDrawerType: string;
  drawerTypes: any;
  aggregationOptions = [
    'Yearly',
    'Monthly',
  ];
  // colors: Array<string>;
  selectedEntries: Array<any>;
  eventToBeDisplayed: Event;

  constructor(private db: DatabaseService, private ts: ThemeService, private mms: MusicMapService) {
    this.events = new Array<Event>();
    this.historicEvents = new Array<HistoricEvent>();

    this.currentDrawerType = 'themes';
    // this.colors = new Array<string>();
    this.drawerTypes = new Array<any>();
    this.drawerTypes.push({ value: 'themes', displayValue: 'Themes', icon: 'donut_large', selected: true });
    this.drawerTypes.push({ value: 'peopleOrganizations', displayValue: 'People', icon: 'account_circle', selected: false});
    this.drawerTypes.push({ value: 'locations', displayValue: 'Places', icon: 'place', selected: false});

    this.currentEventInterval = new Array<Date>();

    this.resultMap = new Map<string, number>();

    this.selectedEntries = new Array<any>();

    this.eventToBeDisplayed = null;
  }

  ngAfterViewInit(): void {
    this.mms.currentlySelectedEvent.subscribe((event: string) => {
      if(!event || !this.previewdrawer) return;
      this.db.getAsEvent(this.db.getEventById(event)).then((success: Event) => {
        this.eventToBeDisplayed = success;
        this.previewdrawer.toggle();
      });
    });
    
    this.mms.currentEventInterval.subscribe((dates: Array<Date>) => {
      if(!dates) return;
      if(dates[0]) {
        this.currentEventInterval[0] = dates[0];
      }
      if(dates[1]) {
        this.currentEventInterval[1] = dates[1];
      }
    });
    
    if(this.db.getEvents().length === 0) {
      this.db.getAllEvents().then((success: Array<Event>) => { 
        this.events = success; 
        this.loading = false;
      }, (error) => { console.log(error); });
    } else {
      // else we gucci
      this.events = this.db.getEvents();
      this.loading = false;
    }
  }

  /**
   * Update the aggregation type for the overview tl
   * @param type - the type of aggregation
   */
  updateAggregation(type: string): void {
    this.mms.setAggregationType(type);
  }

  /**
   * Opens and CLoses a side panel with tl options
   */
  toggleTLOptions(): void {
    this.showTLOptions = !this.showTLOptions;
  }

  /**
   * Toggles the state of the drawer open - close
   */
  themedrawerToggle(): void {
    this.themedrawer.toggle();
  }

  /**
   * Checks to see if the drawer is open (could be undefined if called during initialization)
   * @return boolean - whether the drawer is open or not
   */
  isThemeDrawerOpen(): boolean {
    if(!this.themedrawer) return false; // themedrawer not created yet
    return this.themedrawer.opened;
  }

  /**
   * Checks to see if the drawer is open (could be undefined if called during initialization)
   * @return boolean - whether the drawer is open or not
   */
  isPreviewDrawerOpen(): boolean {
    if(!this.previewdrawer) return false; // themedrawer not created yet
    return this.previewdrawer.opened;
  }

  /**
   * Clears the selected element and closes the preview drawer
   */
  closePreviewDrawer(): void {
    this.eventToBeDisplayed = null;
    this.mms.setSelectedEvent(null);
    this.previewdrawer.toggle();
  }

  /**
   * Sets the contents of the drawer to the selected type
   * @param stype - type of drawer contents 'themes', 'people', 'locations'
   */
  setDrawerType(stype: string): void {
    for(let dT of this.drawerTypes) {
      dT.selected = (dT.value === stype) ? true : false;
    }
    this.currentDrawerType = stype;
  }

  /**
   * Highlight entries in the side-panel drawer
   * @param $event - the click event
   * @param id - the id of the element in the list
   * @param mouseOver - boolean (optional) if we clicked or mouseovered
   */
  highlightEntry($event: any, id: number, mouseOver?: boolean): void {
    console.log($event, id, mouseOver);
    if(!mouseOver && this.selectedEntries.map( s => { return s.id }).indexOf(id) < 0) {
        this.selectedEntries.push({ id: id });
    }
    $event.target.parentElement.parentElement.parentElement.style.backgroundColor = '#b5b5b540'; // 40 is hex for 25% opacity
  }

  /**
   * Un-highlight entries in the side-panel drawer
   * @param $event - the click event
   * @param id - the id of the element in the list
   * @param mouseOver - boolean (optional) if we clicked or mouseovered
   */
  unhighlightEntry($event: any, id: number, mouseOver?: boolean): void {
    if(mouseOver && this.selectedEntries.map(i => { return i.id }).indexOf(id) < 0) {
      $event.target.parentElement.parentElement.parentElement.style.backgroundColor = '';
    }
    if(!mouseOver) {
      // user clicked on close icon - remove selection from list
      this.selectedEntries.splice(this.selectedEntries.map(i => { return i.id }).indexOf(id), 1);
      $event.target.parentElement.parentElement.parentElement.style.backgroundColor = '';
    }
  }

  /**
   * Check if an entry is selected in the side-panel drawer
   * @param id - the id of the element in the list
   * @return boolean - true if selected; false otherwise
   */
  isSelected(id: number): boolean {
    //console.log(this.selectedEntries.map( s => { return s.id }).indexOf(id));
    return this.selectedEntries.map( s => { return s.id }).indexOf(id) >= 0;
  }

  /**
   * Finds event ID's based on the selected attribute and its value
   * @param name - the value of the attribute we are looking for (category, people, location)
   */
  findEvents(name: string, id: number, $event: any): void {
    let results = new Array<string>();
    let eArr = new Array<Event>();
    for(let e of this.events) {
      for(let t of e[this.currentDrawerType]) {
        if(t.name === name) {
          results.push(e.objectId);
          eArr.push(e);
        }
      }
    }
    this.mms.setSelectedEvents(results);
  }

  /**
   * Triggered when a mouse hovers on a drawer entry
   * @param $event - mouse event
   * @param id - id of the drawer entry
   */
  mouseOver($event: any, id: number): void {
    this.highlightEntry($event, id, true);
  }

  /**
   * Triggered when a mouse hovers out of a drawer entry
   * @param $event - mouse event
   * @param id - id of the drawer entry
   */
  mouseOut($event: any, id: number): void {
    this.unhighlightEntry($event, id, true);
  }

  /**
   * Updates the EventService's currentEventInterval
   */
  updateSelectedInterval(): void {
    this.mms.updateEventInterval([this.selectedStartDate, this.selectedEndDate]);
  }

  /**
   * Sets end date to original end date (new Date() --- Today)
   * Calls the event service to update the selected interval
   */
  clearEndDate(): void {
    this.selectedEndDate = this.mms.endDate;
    this.mms.updateEventInterval([this.selectedStartDate, this.selectedEndDate]);
  }

  /**
   * Sets start date to original start date (1. Jan. 1918)
   * Calls the event service to update the selected interval
   */
  clearStartDate(): void {
    this.selectedStartDate = this.mms.startDate;
    this.mms.updateEventInterval([this.selectedStartDate, this.selectedEndDate]);
  }
}
