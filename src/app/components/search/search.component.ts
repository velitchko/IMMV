import { Component, Input, ChangeDetectorRef } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { startWith, map } from 'rxjs/operators';
import { EventService } from '../../services/event.service';
import { LocationService } from '../../services/location.service';
import { PersonOrganizationService } from '../../services/people.organizations.service';
import { SourceService } from '../../services/sources.service';
import { ThemeService } from '../../services/themes.service';
import { MusicMapService } from '../../services/musicmap.service';

@Component({
  selector: 'app-search',
  templateUrl: 'search.component.html',
  styleUrls: ['search.component.scss']
})

export class SearchComponent {
  searchCtrl: FormControl;
  filteredItems: Observable<Array<any>>;
  showSearch = false;
  @Input() items: Array<any>;
  searchType: string;
  searchIcon: string;
  searchTypes: any;
  objectIdArr: Array<any>;
  loadingEntries: boolean;
  displayClear: boolean = false;
  constructor(private change: ChangeDetectorRef,
    private es: EventService,
    private ps: PersonOrganizationService,
    private ls: LocationService,
    private ss: SourceService,
    private ts: ThemeService,
    private mms: MusicMapService) {
    this.searchIcon = 'event';
    this.objectIdArr = new Array<any>();
    this.searchTypes = [
      {
        icon: 'account_circle',
        value: 'people',
        selected: false,
      }, {
        icon: 'event',
        value: 'events',
        selected: true,
      }, {
        icon: 'history',
        value: 'historicevents',
        selected: false,
      }, {
        icon: 'place',
        value: 'locations',
        selected: false,
      }, {
        icon: 'collections',
        value: 'sources',
        selected: false,
      }, {
        icon: 'donut_large',
        value: 'themes',
        selected: false,
      }, {
        icon: 'domain',
        value: 'organizations',
        selected: false,
      }];
    // TODO add historic events
    this.loadingEntries = false;
    this.searchCtrl = new FormControl();
    this.filteredItems = this.searchCtrl.valueChanges
      .pipe(
        startWith(''),
        map((item: any) => {
          return item ? this.filterItems(item) : this.items.slice();
        })
      );
  }
  //TODO not working for people / organizations 'name of undefined??'
  // should probably check the organizations / people arrays and make sure we have only those objects
  // or add name attribute on organization (set in constructor) with the first valid or 'official' name
  /**
   * Updates the this.items array and the filteredItems Observable
   * @param newItems - array of new items coming from getItemsBasedOnType
   */
  updateFilteredItems(newItems: Array<any>): void {
    this.displayClear = true;
    this.items = newItems;
    this.filteredItems = this.searchCtrl.valueChanges
      .pipe(
        startWith(''),
        map((item: any) => {
          return item ? this.filterItems(item) : this.items.slice();
        })
      );
    this.loadingEntries = false;
    // force change detection
    this.change.markForCheck();
  }
  /**
   * Clears the search input and resets the objectIdArr
   * Broadcasts changes to the MusicMapService
   */
  clearSearch() {
    this.displayClear = false;
    this.searchCtrl.setValue('');
    this.objectIdArr = new Array<any>();
    //this.mms.setobjectIds(this.objectIdArr);
  }

  /**
   * Returns an array of items based on the selected searchType
   @return array - an array of corresponding items based on the searchType
   */
  getItemsBasedOnType(type: string): void {
    // should check if returned array is empty
    // if so we need to get the data from DB
    if (type === 'locations') {
      if (this.ls.getLocations().length) {
        this.updateFilteredItems(this.ls.getLocations());
      } else {
        // we need to get data from server
        this.ls.getAllLocations().then((success) => {
          // update filtered items array
          this.updateFilteredItems(success);
        }).catch((err) => {
          console.log(err);
        });
      }
    } else if (type === 'events') {
      if (this.es.getEvents().length) {
        this.updateFilteredItems(this.es.getEvents());
      } else {
        // we need to get data from server
        this.es.getAllEvents().then((success) => {
          // update filtered items array
          this.updateFilteredItems(success);
        }).catch((err) => {
          console.log(err);
        });
      }
    } else if (type === 'themes') {
      if (this.ts.getThemes().length) {
        this.updateFilteredItems(this.ts.getThemes());
      } else {
        // we need to get data from server
        this.ts.getAllThemes().then((success) => {
          // update filtered items array
          this.updateFilteredItems(success);
        }).catch((err) => {
          console.log(err);
        });
      }
    } else if (type === 'sources') {
      if (this.ss.getSources().length) {
        this.updateFilteredItems(this.ss.getSources());
      } else {
        // we need to get data from server
        this.ss.getAllSources().then((success) => {
          // update filtered items array
          this.updateFilteredItems(success);
        }).catch((err) => {
          console.log(err);
        });
      }
    } else if (type === 'organizations') {
      if (this.ps.getOrganizations().length) {
        this.updateFilteredItems(this.ps.getOrganizations());
      } else {
        // we need to get data from server
        this.ps.getAllPeopleOrganizations().then((success) => {
          // update filtered items array
          success = success.filter((p: any) => { return p.objectType === 'Organization'; });
          this.updateFilteredItems(success);
        }).catch((err) => {
          console.log(err);
        });
      }
    } else if (type === 'people') {
      if (this.ps.getPeople().length) {
        this.updateFilteredItems(this.ps.getPeople());
      } else {
        // we need to get data from server
        this.ps.getAllPeopleOrganizations().then((success) => {
          // update filtered items array
          success = success.filter((p: any) => { return p.objectType === 'Person'; });
          this.updateFilteredItems(success);
        }).catch((err) => {
          console.log(err);
        });
      }
    } else if (type === 'historicevents') {
      if (this.es.getHistoricEvents().length) {
        this.updateFilteredItems(this.es.getHistoricEvents());
      } else {
        this.es.getAllHistoricEvents().then((success) => {
          this.updateFilteredItems(success);
        }).catch((err) => {
          console.log(err);
        });
      }
    }
    else {
      this.updateFilteredItems(this.items);
    }
  }

  /**
   * Sets the searchType variable to the selected option
   @param type - the type coming from the select element
   */
  setSearchType(type: any): void {
    this.loadingEntries = true;
    this.searchType = type.value;
    this.searchTypes.forEach((st: any) => {
      if (st.value === type.value) {
        st.selected = true;
        this.searchIcon = st.icon;
      } else {
        st.selected = false;
      }
    });
    // update our items array
    // TODO find out why is not working for sources, themes, people/organizations
    this.getItemsBasedOnType(this.searchType);
  }

  /**
   * Performs filtering on items based on the specificed type (searchType)
   * @param name - the name value we are searching for
   * @return results - array of results matching the name
   */
  filterItems(name: string): Array<any> {
    let results = this.items.filter((item: any) => {
      return item.name.toLowerCase().indexOf(name.toLowerCase()) === 0;
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
    let searchName = item.objectId;
    let events = this.es.getEvents();
    for (let i of events) {
      if (i.objectId === searchName) {
        if (!this.objectIdArr.find((r: any) => { return r === i.objectId; })) {
          this.objectIdArr.push(i.objectId);
        }
      }
      if (this.searchType === 'events') {
        for (let ii of i.events) {
          if (ii.event === searchName) {
            if (!this.objectIdArr.find((r: any) => { return r === i.objectId; })) {
              this.objectIdArr.push(i.objectId); // outer events record id (e.g. main event)
              continue;
            }
          }
        }
      } // look in events.events
      if (this.searchType === 'people') {
        for (let p of i.peopleOrganizations) {
          if (p.personOrganization === searchName) {
            if (!this.objectIdArr.find((r: any) => { return r === i.objectId; })) {
              this.objectIdArr.push(i.objectId);
              break;
            }
          }
        }
      }
      // look in events.people
      if (this.searchType === 'organizations') {
        for (let o of i.peopleOrganizations) {
          if (o.personOrganization === searchName) {
            if (!this.objectIdArr.find((r: any) => { return r === i.objectId; })) {
              this.objectIdArr.push(i.objectId);
              break;
            }
          }
        }
      } // look in events.organizations
      if (this.searchType === 'themes') {
        for (let t of i.themes) {
          if (t.theme.objectId === searchName) {
            if (!this.objectIdArr.find((r: any) => { return r === i.objectId; })) {
              this.objectIdArr.push(i.objectId);
              break;
            }
          }
        }
      } // look in events.themes
      if (this.searchType === 'sources') {
        for (let s of i.sources) {
          if (s.source === searchName) {
            if (!this.objectIdArr.find((r: any) => { return r === i.objectId; })) {
              this.objectIdArr.push(i.objectId);
              break;
            }
          }
        }
      } // look in events.sources
      if (this.searchType === 'historicevents') {
        for (let h of i.historicEvents) {
          if (h.historicEvent === searchName) {
            if (!this.objectIdArr.find((r: any) => { return r === i.objectId; })) {
              this.objectIdArr.push(i.objectId);
              break;
            }
          }
        }
      } // look in events.historicEvents
      if (this.searchType === 'locations') {
        for (let l of i.locations) {
          if (l.location === searchName) {
            if (!this.objectIdArr.find((r: any) => { return r === i.objectId; })) {
              this.objectIdArr.push(i.objectId);
              break;
            }
          }
        }
      } // look in events.location
    }
    // this.mms.setobjectIds(this.objectIdArr);
    this.objectIdArr.forEach((id) => {
      let ev = events.find((e: any) => {
        return e.objectId === id;
      });
      if (ev) {
        console.log(ev.name + ' found');
      }
    });
    // TODO: highlight shit via mms (remember how?)
    console.log('---------------');
  }
}
