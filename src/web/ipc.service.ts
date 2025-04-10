import { Injectable } from '@angular/core';
import { IpcRenderer } from 'electron'; 
import { SalesforceService } from './app/salesforce.service';

@Injectable({ providedIn: 'root' })
export class IpcService {
    private _ipc: IpcRenderer | undefined | SalesforceService = void 0;

    constructor(private _sfSvc : SalesforceService) {
        if ((window as Window).customIpc) {
            try {
                // console.log('^^^^ ' , window.customIpc);
                // this._ipc = window.require('electron').ipcRenderer;
                this._ipc = window.customIpc;
                console.log('Electron\'s IPC LOADED SUCCESFULLY', this._ipc);
            } catch (e) {
                console.warn('Electron\'s IPC was not loaded due to ERROR');
                throw e;
            }
        } else {
            console.warn('Electron\'s IPC was not loaded');
            console.log('#$#$ WEB MODE');
            this._ipc = _sfSvc;
        }
    }

    public on(channel: string, listener: any): void {
        if (!this._ipc) {
            return;
        }
        // this._ipc.on(channel, listener);
        this._ipc.once(channel, listener);
    }

    public send(channel: string, ...args: Array<any>): void {
        if (!this._ipc) {
            return;
        }
        this._ipc.send(channel, ...args);
    }


    public async getOrgs(){
        console.log('ipc.service | getOrgs ');
        if(!this._ipc) {
            return;
        }
        return new Promise(function(this: IpcService, resolve: Function, reject: Function){
            this.on('getOrgs', function(x: any, y: any){
                console.log('ipc.service | getOrgs | resolved ' , y);
                resolve(y[0]);
            });
            console.log('ipc.service | getOrgs | req')
            this.send('getOrgs');
        }.bind(this));
    }

    public async authenticate(orgName : string) {
        console.log('ipc.service | authenticate ');
        if(!this._ipc) {
            return;
        }
        return new Promise(function(this: IpcService, resolve: Function, reject: Function){
            this.on('authenticate', function(x: any, y: any){
                console.log('ipc.service | authenticate | resolved ', y);
                resolve(y[0]);
            });
            console.log('ipc.service | authenticate | req');
            this.send('authenticate', orgName);
        }.bind(this));
    }

    public async callMethod(methodName: string, ...param: any) : Promise<any>{
        console.log('ipc.service | callMethod - ' + methodName + " | params " , param);
        if(!this._ipc) {
            return;
        }
        return new Promise(function(this: IpcService, resolve: Function, reject: Function){
            this.on(methodName, function(x: any, y: any){
                console.log(`ipc.service | callMethod - ${methodName} | resolved `);
                resolve(y[0]);
            });
            console.log(`ipc.service | callMethod - ${methodName} | req`);
            this.send(methodName, ...param);
        }.bind(this));
    }

}