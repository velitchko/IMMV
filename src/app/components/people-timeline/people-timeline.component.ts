import { Component, OnInit, Inject, AfterViewInit, PLATFORM_ID, ViewChild, ElementRef } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { DatabaseService } from '../../services/db.service';
import { PersonOrganization } from 'src/app/models/person.organization';
import { DataSet, Timeline } from 'vis';
import * as moment from 'moment';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { FormControl } from '@angular/forms';

@Component({
  selector: 'app-people-timeline',
  templateUrl: './people-timeline.component.html',
  styleUrls: [ './people-timeline.component.scss' ]
})

export class PeopleTimelineComponent implements AfterViewInit {
    timeline: Timeline;
    peopleOrganizations: Array<PersonOrganization>;
    timelineItems: DataSet;
    timelineGroups: DataSet;

    showClear: boolean = false;
    searchCtrl: FormControl;
    filteredItems: Observable<PersonOrganization[]>;

    isBrowser: boolean = false;
    @ViewChild('peopletimeline') timelineContainer: ElementRef;

    constructor(private db: DatabaseService, @Inject(PLATFORM_ID) private _platformId: Object) {
        this.isBrowser = isPlatformBrowser(this._platformId);
        this.timelineItems = new DataSet();
        this.timelineGroups = new DataSet();
        this.peopleOrganizations = new Array<PersonOrganization>();
        this.searchCtrl = new FormControl();
      
        this.db.getAllPeopleOrganizationsEvents()
        .then((success) => {
            this.peopleOrganizations = Array.from(success);
            this.filteredItems = this.searchCtrl.valueChanges
            .pipe(
                startWith(''),
                map((person) => person ? this.filterItems(person) : this.peopleOrganizations.slice())
            )
            if(this.isBrowser) this.createTimeline(success);
        }).catch((err) => {
            console.log(err);
        });
    }

    filterItems(name: string): Array<PersonOrganization> {
        this.showClear = true;
        return this.peopleOrganizations.filter((person: PersonOrganization) => {
            return person.name.toLowerCase().includes(name.toLowerCase());
        });
    }

    ngAfterViewInit(): void {
        
    }

    addToTimeline(person: PersonOrganization): void {
        let i = this.timelineGroups.length;

        if(this.timelineGroups.map((group) => { return group.content }).includes(person.name)) {
            console.error('Person already added to timeline');
            return;
        }

        if(person.objectType !== 'Person') {
            console.error('Cannot add organizations to timeline');
            return;
        } 
        this.timelineGroups.add({
            id: i,
            content: person.name
        });

        person.functions.forEach((func: any, j: number) => {
            if(!func.startDate || (!func.startDate && !func.endDate)) return;
            let type = func.startDate && func.endDate ? 'range' : 'point';
            // console.log(`${func.startDate} - ${func.endDate}`);
            this.timelineItems.add({
                group: i,
                id: func._id,
                start: func.startDate,
                end: func.endDate,
                //content: i.name,
                title: this.getHTMLTooltip(person.name, func),
                type: type,
                objectType: person.objectType,
                objectId: person.objectId
                // className: i.geodata.length !== 0 ? 'has-location' : 'no-location'
                });
        });
    }

    clearSearch(): void {
        this.showClear = false;
        this.searchCtrl.setValue('');
    }

    getHTMLTooltip(name: string, func: any): string {
        let endDate = func.endDate ? true : false;
        return `${name} was ${func.dateName} ${endDate ? `from` : `at`} ${moment(func.startDate).format('DD-MM-YYYY')}${endDate ? ` to ${moment(func.endDate).format('DD-MM-YYYY')}.` : '.'}`;
    }

    parseData(peopleOrganizations: Array<PersonOrganization>): void {
        peopleOrganizations.forEach((personOrganization: PersonOrganization, i: number) => {
            if(personOrganization.objectType !== 'Person') return;
            this.timelineGroups.add({
                id: i,
                content: personOrganization.name
            });
            personOrganization.functions.forEach((func: any, j: number) => {
                if(!func.startDate || (!func.startDate && !func.endDate)) return;
                let type = func.startDate && func.endDate ? 'range' : 'point';
                // console.log(`${func.startDate} - ${func.endDate}`);
                this.timelineItems.add({
                    group: i,
                    id: func._id,
                    start: func.startDate,
                    end: func.endDate,
                    //content: i.name,
                    title: this.getHTMLTooltip(personOrganization.name, func),
                    type: type,
                    objectType: personOrganization.objectType,
                    objectId: personOrganization.objectId
                    // className: i.geodata.length !== 0 ? 'has-location' : 'no-location'
                    });
            });
        });
    }
    
    createTimeline(peopleOrganizations?: Array<PersonOrganization>): void {
        
        // this.parseData(peopleOrganizations);

        let options = {
            showTooltips: true,
            start: new Date('1900'),
            end: Date.now(),
            // min: this.mms.getOriginalStartDate(), //new Date(this.x.domain()[0].getFullYear()-1, this.x.domain()[0].getMonth(), this.x.domain()[0].getDate()),
            // max: this.mms.getOriginalEndDate(), //new Date(this.x.domain()[1].getFullYear()+1, this.x.domain()[1].getMonth(), this.x.domain()[1].getDate()),
            autoResize: true,
            showCurrentTime: false,
            groupOrder: 'content', // order group by group property
          //  showMinorLabels: false,
            height: '600px', // map ~ 55vh
            // minHeight:  '100%',
            // zoomMax: 	3153600000000, // 100 years in ms
            // zoomMin: 604800000, // 7 days in ms
            //verticalScroll: true,
          };

          this.timeline = new Timeline(this.timelineContainer.nativeElement);
          this.timeline.setOptions(options);
          this.timeline.setGroups(this.timelineGroups);
          this.timeline.setItems(this.timelineItems);
        //   this.timeline.on('rangechanged', this.rangeChanged());
        //   this.timeline.on('select', this.eventSelected());

    }

}