import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { startWith, map } from 'rxjs/operators';
import { DatabaseService } from '../../services/db.service';
import { MusicMapService } from '../../services/musicmap.service';
import { Event } from '../../models/event';
import { HistoricEvent } from '../../models/historic.event';
import { PersonOrganization } from '../../models/person.organization';
import { Location } from '../../models/location';
import { Source } from '../../models/source';
import { Theme } from '../../models/theme';

@Component({
  selector: 'app-search',
  templateUrl: 'search.component.html',
  styleUrls: ['search.component.scss']
})

export class SearchComponent {
  searchCtrl: FormControl;
  filteredItems: Observable<Array<any>>;

  items: Array<any>;

  objectTypes: Map<string, string>;
  results: Array<string>;

  showSearch: boolean = false;
  displayClear: boolean = false;

  constructor(private db: DatabaseService, private mms: MusicMapService) {
    this.items = new Array<any>();
    this.results = new Array<string>();
    this.objectTypes = new Map<string, string>();

    this.getData();

    this.objectTypes.set('event', 'event');
    this.objectTypes.set('historicevent', 'history');
    this.objectTypes.set('location', 'place');
    this.objectTypes.set('source', 'collections');
    this.objectTypes.set('theme', 'donut_large');
    this.objectTypes.set('person', 'account_circle');
    this.objectTypes.set('organization', 'domain');

    this.searchCtrl = new FormControl();
    this.filteredItems = this.searchCtrl.valueChanges
      .pipe(
        startWith(''),
        map((item: any) => {
          return item ? this.filterItems(item) : this.items.slice();
        })
      );
  }

  /**
   * Adds the data object along with its type to the items array which is filterable 
   * @param data the data object (Event, HistoricEvent, Person/Organization, etc.)
   * @param type string description of the object for setting icon in search results
   */
  addData(data: Array<any>, type: string): void {
    data.forEach((s: any) => {
      this.items.push({ object: s, type: type });
    });
  }

  /**
   * Gets data from the db service 
   * if db service has no data look up 
   */
  getData(): void {
    // no events
    if (this.db.getEvents().length === 0) {
      this.db.getAllEvents(true).then((success: Array<Event>) => {
        this.addData(success, 'event');
      });
    } else {
      this.addData(this.db.getEvents(), 'event');
    }

    // no historic events
    if (this.db.getHistoricEvents().length === 0) {
      this.db.getAllHistoricEvents(true).then((success: Array<HistoricEvent>) => {
        this.addData(success, 'historicevent');
      });
    } else {
      this.addData(this.db.getHistoricEvents(), 'historicevent');
    }

    // no people / organizations
    if (this.db.getPeopleOrganizations().length === 0) {
      this.db.getAllPeopleOrganizations().then((success: Array<PersonOrganization>) => {
        this.addData(success, 'personorganization');
      });
    } else {
      this.addData(this.db.getPeopleOrganizations(), 'personorganization');
    }

    // no locations
    if (this.db.getLocations().length === 0) {
      this.db.getAllLocations().then((success: Array<Location>) => {
        this.addData(success, 'location');
      });
    } else {
      this.addData(this.db.getLocations(), 'personorganization');
    }

    // no themes
    if (this.db.getThemes().length === 0) {
      this.db.getAllThemes().then((success: Array<Theme>) => {
        this.addData(success, 'theme');
      });
    } else {
      this.addData(this.db.getThemes(), 'location');
    }

    // no sources
    if (this.db.getSources().length === 0) {
      this.db.getAllSources().then((success: Array<Source>) => {
        this.addData(success, 'source');
      });
    } else {
      this.addData(this.db.getSources(), 'theme');
    }
  }

  /**
   * Clears the search input and resets the objectIdArr
   * Broadcasts changes to the MusicMapService
   */
  clearSearch() {
    this.displayClear = false;
    this.searchCtrl.setValue('');
    this.results = new Array<string>();
    //this.mms.setobjectIds(this.objectIdArr);
  }

  /**
   * Performs filtering on items based on the specificed type (searchType)
   * @param name - the name value we are searching for
   * @return results - array of results matching the name
   */
  filterItems(name: string): Array<any> {
    this.displayClear = true;
    let results = this.items.filter((item: any) => {
      return item.object.name.toLowerCase().includes(name.toLowerCase());
    });
    return results;
  }

  /**
   * Toggles the searchbars visibility
   */
  toggleSearchBar(): void {
    this.showSearch = !this.showSearch;
  }

  /**
   * Finds corresponding event id's and highlights them in the timeline and maps by
   * broadcasting over the MusicMapService
   * @param item - the item from the search field
   */
  highlightEvent(item: any): void {
    // item.type -> search type if anything but event -> find events related to it
    switch (item.type) {
      case 'historicevent':
        this.db.getEventsByHistoricEvent(item.object).then((success: Array<HistoricEvent>) => {
          this.results = success.map((e: HistoricEvent) => { return e.objectId; });
          this.mms.setObjectIds(this.results);
        });
        break;

      case 'personorganization':
        this.db.getEventsByPersonOrganization(item.object).then((success: Array<PersonOrganization>) => {
          this.results = success.map((e: PersonOrganization) => { return e.objectId; });
          this.mms.setObjectIds(this.results);
        });
        break;

      case 'location':
        this.db.getEventsByLocation(item.object).then((success: Array<Location>) => {
          this.results = success.map((e: Location) => { return e.objectId; });
          this.mms.setObjectIds(this.results);
        });
        break;

      case 'theme':
        this.db.getEventsByTheme(item.object).then((success: Array<Theme>) => {
          this.results = success.map((e: Theme) => { return e.objectId; });
          this.mms.setObjectIds(this.results);
        });
        break;

      case 'source':
        this.db.getEventsBySource(item.object).then((success: Array<Source>) => {
          this.results = success.map((e: Source) => { return e.objectId; });
          this.mms.setObjectIds(this.results);
        });
        break;

      case 'event':
        this.db.getEventsByEvent(item.object).then((success: Array<Event>) => {
          this.results = success.map((e: Event) => { return e.objectId; });
          this.mms.setObjectIds(this.results);
        });
        break;

      default: break;
    }
  }
}
