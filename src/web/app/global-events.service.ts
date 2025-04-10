import { EventEmitter, Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class GlobalEventsService {

    globalClickEvent : EventEmitter<any> = new EventEmitter();

    constructor() { }
}
