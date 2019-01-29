import { Injectable } from '@angular/core';
import { Event } from '../models/event';
import { Location } from '../models/location';
import { HistoricEvent } from '../models/historic.event';
import { BehaviorSubject } from 'rxjs';

@Injectable()
export class MusicMapService {

  private selectedItems = new BehaviorSubject<Array<Date>>(null);
  currentlySelectedItems = this.selectedItems.asObservable();

  private highlightItem = new BehaviorSubject<any>(null);
  currentlyHighlightedItem = this.highlightItem.asObservable();

  private aggregationItem = new BehaviorSubject<string>("");
  currentAggregationItem = this.aggregationItem.asObservable();

  private sectionSizes = new BehaviorSubject<Array<number>>(null);
  currentSectionSizes = this.sectionSizes.asObservable();

  private colorAssignment = new BehaviorSubject<Map<string, string>>(null);
  currentColorAssignment = this.colorAssignment.asObservable();

  private selectedEvent = new BehaviorSubject<Event>(null);
  currentlySelectedEvent = this.selectedEvent.asObservable();

  private eventInterval = new BehaviorSubject<Array<Date>>(null);
  currentEventInterval = this.eventInterval.asObservable();

  private _START_DATE: Date;
  private _END_DATE: Date;

  constructor() {
    this._START_DATE = new Date('1/1/1918');
    this._END_DATE = new Date(); // Today
  }

  getOriginalStartDate(): Date {
    return this._START_DATE;
  }

  getOriginalEndDate(): Date {
    return this._END_DATE;
  }
  
  /**
   * Updates the time interval that the user is looking at
   @param dates - a date array index 0 is the minimum date, index 1 is the maximum date
   */
  updateEventServiceInterval(dates: Array<Date>): void {
    this.eventInterval.next(dates);
  }

  highlightMapMarker(id: number) {

  }

  setSelectedEvent(event: Event): void {
    // console.log('setting event');
    // console.log(event);
    this.selectedEvent.next(event);
  }

  /**
   * Sets the color assignment from the musicmap component
   * We use this function to notify child and other components of our
   * selected color coding
   * @param colorMap - map<k,v> - key is the selected attribute, value is the color in hex
   */
  setColorAssignment(colorMap: Map<string,string>): void {
    // console.log(colorMap);
    this.colorAssignment.next(colorMap);
  }

  getColorAssignmentForCategory(category: string): string {
    // console.log(category, this.colorAssignment.getValue().get(category));
    return this.colorAssignment.getValue().get(category);
  }

  /**
   * Sets the currently selected objectIds - called from components that want to
   * communicate selections between each other
   * @param objectIdArr - the array of record ids
   */
  setObjectIds(objectIdArr: Array<any>): void {
    this.selectedItems.next(objectIdArr);
  }

  /**
   * Sets the currently selected items by index and highlights
   * @param highlight - highlight.idx - the index of the event (objectId)
   *                  - highlight.frommap - boolean true if updated from the map
   */
  setHighlight(highlight: any): void {
    this.highlightItem.next(highlight);
  }

  /**
   * Sets the currently selected aggregation type
   * @param type - type of aggregation
   */
  setAggregationType(type: string): void {
    this.aggregationItem.next(type);
  }

  /**
   * Sets the currently selected section sizes
   * @param sizes - the array of sizes in % (vh)
   */
  setSectionSizes(sizes: Array<number>): void {
    this.sectionSizes.next(sizes);
  }

  /**
   * Checks if two events have an overlap
   * @param eventA - the first event with start and end dates
   * @param eventB - the second event with start and end dates
   * @return boolean - true is overlap happens, false otherwise
   */
  checkIfOverlap(eventA: Event, eventB: Event): boolean {
    return eventA.startDate <= eventB.endDate && eventB.startDate <= eventA.endDate;
  }

  /**
   * Checks if two dates are in a given range
   * @param startA - the start date of range
   * @param endA - the end date of range
   * @param startB - the start date of an event
   * @param endB - the end date of an event
   * @return boolean - true is overlap happens, false otherwise
   */
  checkIfInInterval(startA: Date, endA: Date, startB: Date, endB: Date) {
    //console.log(`[${this.prettyPrintDate(startA)},${this.prettyPrintDate(endA)}] - [${this.prettyPrintDate(startB)},${this.prettyPrintDate(endB)}] : ${(startA <= endB && startB <= endA)}`);
    return startA <= endB && startB <= endA;
  }

  /**
   * Checks if there are events occurring on a given date
   * @param date - the date we want to check
   * @param event - the event we want to check
   * @return boolean - true if event happens on date, false otherwise
   */
  checkIfInRange(date: Date, event: Event, aggregation: string): boolean {
    // we are checking on monthly basis currently
    // date is startDate of month 01.XX.XXXX
    // we compute the last date of the month in endDate
    let startDate = date;
    let endDate; 
    
    switch(aggregation) {
      case 'Yearly': 
        endDate = new Date(date.getFullYear()+1, date.getMonth(), 0);
        break;
      case 'Monthly':
        endDate = new Date(date.getFullYear(), date.getMonth()+1, 0);
        break;
      default:  
        endDate = new Date(date.getFullYear()+1, date.getMonth(), 0);
        break;
    }
    return event.startDate <= endDate && startDate <= event.endDate;
  }

  /**
   * Utility function for printing gates in the format DD/MM/YYYY
   * @param date - the date object to print
   * @param seperator - if true prepends a ' - ' to the date
   */
  prettyPrintDate(date: Date, separator?: boolean): string {
    if(date === null) return '';
    if(isNaN(date.getTime())) return '';
    return (separator ? ' - ' : '') + date.getDate() +  '/' + (date.getMonth() + 1) + '/' + date.getFullYear();
  }
}
