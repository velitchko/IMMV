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
  filteredItems: Array<any>;

  objectTypes: Map<string, string>;

  showSearch: boolean = false;
  displayClear: boolean = false;
  loadingResults: boolean = false;
  

  constructor(private db: DatabaseService, private mms: MusicMapService) {
    this.itemSelected = new EventEmitter<any>();
    this.objectTypes = new Map<string, string>();

    this.filteredItems = new Array<any>();

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
        let groupedArr = new Array<any>();

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
        this.filteredItems = groupedArr;
      });
  }

  clearSearch(): void {}

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

  
  filterItems(value: string): Observable<Array<any>> {
    const filterValue = value.toLowerCase();
    // use from operator (rxjs) to convert promise to observable
    return from(this.db.findObjects(filterValue));
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
}
