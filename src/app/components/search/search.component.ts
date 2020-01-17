import { Component, Output, EventEmitter } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { DatabaseService } from '../../services/db.service';
import { MusicMapService } from '../../services/musicmap.service';
import { Event } from '../../models/event';
import { HistoricEvent } from '../../models/historic.event';
import { PersonOrganization } from '../../models/person.organization';
import { Location } from '../../models/location';
import { Source } from '../../models/source';
import { Theme } from '../../models/theme';
import { map, switchMap, startWith, debounceTime, tap, finalize } from 'rxjs/operators';
import { from } from 'rxjs';

@Component({
  selector: 'app-search',
  templateUrl: 'search.component.html',
  styleUrls: ['search.component.scss']
})

/**
 * TODO: Use input/output to emit events when actions are performed on the search component
 */
export class SearchComponent {
  @Output('itemSelected') itemSelected: EventEmitter<any>;
  searchCtrl: FormControl;
  filteredItems: Observable<Array<any>>;

  items: Array<any>;

  objectTypes: Map<string, string>;
  results: Array<string>;

  showSearch: boolean = false;
  displayClear: boolean = false;
  loadingResults: boolean = false;
  

  constructor(private db: DatabaseService, private mms: MusicMapService) {
    this.itemSelected = new EventEmitter<any>();
    this.items = new Array<any>();
    this.results = new Array<string>();
    this.objectTypes = new Map<string, string>();


    this.objectTypes.set('event', 'event');
    this.objectTypes.set('historicevent', 'history');
    this.objectTypes.set('location', 'place');
    this.objectTypes.set('source', 'collections');
    this.objectTypes.set('theme', 'donut_large');
    this.objectTypes.set('person', 'account_circle');
    this.objectTypes.set('organization', 'domain');

    this.searchCtrl = new FormControl();
    
    // TODO: Replace using filteredItems observable
    // reconsider what the results array is for.
    this.searchCtrl.valueChanges
      .pipe(
        debounceTime(300), // 300ms debounce
        tap(() => { this.loadingResults = true; }),
        switchMap(value => this.filterItems(value)
          .pipe(
            finalize(() => {
              this.loadingResults = false;
            }),
          )
        )
      ).subscribe(results => {
        let grouped = this.groupBy(results, 'objectType');
        let groupedArr = [];

        if(grouped['Event']) {
          groupedArr.push({
            name: 'Events',
            results: grouped['Event'].sort((a: Event, b: Event) => {
              return a.name.localeCompare(b.name);
            })
          });
        }

        if(grouped['HistoricEvent']) {
          groupedArr.push({
            name: 'Historic Events',
            results: grouped['HistoricEvent'].sort((a: HistoricEvent, b: HistoricEvent) => {
              return a.name.localeCompare(b.name);
            })
          });
        }

        if(grouped['Location']) {
          groupedArr.push({
            name: 'Locations',
            results: grouped['Location'].sort((a: Location, b: Location) => {
              return a.name.localeCompare(b.name);
            })
          });
        }

        if(grouped['Source']) {
          groupedArr.push({
            name: 'Sources',
            results: grouped['Source'].sort((a: Source, b: Source) => {
              return a.name.localeCompare(b.name);
            })
          });
        }

        if(grouped['Person']) {
          groupedArr.push({
            name: 'People',
            results: grouped['Person'].sort((a: PersonOrganization, b: PersonOrganization) => {
              return a.name.localeCompare(b.name);
            })
          });
        }

        if(grouped['Organization']) {
          groupedArr.push({
            name: 'Organizations',
            results: grouped['Organization'].sort((a: PersonOrganization, b: PersonOrganization) => {
              return a.name.localeCompare(b.name);
            })
          });
        }

        if(grouped['Theme']) {
          groupedArr.push({
            name: 'Themes',
            results: grouped['Theme'].sort((a: Source, b: Source) => {
              return a.name.localeCompare(b.name);
            })
          });
        }
        this.loadingResults = false;
        this.results = groupedArr;
      });
    // this.filteredItems = this.searchCtrl.valueChanges
    //   .pipe(
    //     startWith(''),
    //     map((item: any) => {
    //       return item ? this.filterItems(item) : this.items.slice();
    //     })
    //   );
  }

  groupBy(objectArray: Array<any>, property: string): Object {
    return objectArray.reduce((acc: Array<any>, obj: any) => {
      let key = obj[property];
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(obj);
      return acc;
    }, {});
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

  
  filterItems(value: string): Observable<Array<any>> {
    const filterValue = value.toLowerCase();
    // use from operator (rxjs) to convert promise to observable
    return from(this.db.findObjects(filterValue));
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
    // should clear selection in map and tl
    this.mms.setSelectedEvents(this.results);
  }

  selectedItem(item: any): void {
    this.itemSelected.emit(item);
  }
  /**
   * Performs filtering on items based on the specificed type (searchType)
   * @param name - the name value we are searching for
   * @return results - array of results matching the name
   */
  // filterItems(name: string): Array<any> {
  //   this.displayClear = true;
  //   let results = this.items.filter((item: any) => {
  //     return item.object.name.toLowerCase().includes(name.toLowerCase());
  //   });
  //   return results;
  // }

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
          this.mms.setSelectedEvents(this.results);
        });
        break;

      case 'personorganization':
        this.db.getEventsByPersonOrganization(item.object).then((success: Array<PersonOrganization>) => {
          this.results = success.map((e: PersonOrganization) => { return e.objectId; });
          this.mms.setSelectedEvents(this.results);
        });
        break;

      case 'location':
        this.db.getEventsByLocation(item.object).then((success: Array<Location>) => {
          this.results = success.map((e: Location) => { return e.objectId; });
          this.mms.setSelectedEvents(this.results);
        });
        break;

      case 'theme':
        this.db.getEventsByTheme(item.object).then((success: Array<Theme>) => {
          this.results = success.map((e: Theme) => { return e.objectId; });
          this.mms.setSelectedEvents(this.results);
        });
        break;

      case 'source':
        this.db.getEventsBySource(item.object).then((success: Array<Source>) => {
          this.results = success.map((e: Source) => { return e.objectId; });
          this.mms.setSelectedEvents(this.results);
        });
        break;

      case 'event':
        this.db.getEventsByEvent(item.object).then((success: Array<Event>) => {
          this.results = success.map((e: Event) => { return e.objectId; });
          this.mms.setSelectedEvents(this.results);
        });
        break;

      default: break;
    }
  }
}
