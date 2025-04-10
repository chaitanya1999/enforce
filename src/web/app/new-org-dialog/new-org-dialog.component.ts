import { Component, Inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { OrgCredential } from '../OrgCredential';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';


@Component({
  selector: 'app-new-org-dialog',
  standalone: true,
  imports: [MatCardModule, FormsModule],
  templateUrl: './new-org-dialog.component.html',
  styleUrl: './new-org-dialog.component.css'
})
export class NewOrgDialogComponent {

    orgCred : OrgCredential = <OrgCredential>{
        loginUrl : 'https://test.salesforce.com',
        authMode : 'soapLogin'
    };
    validation : boolean = false;
    orgCredsMap : any;
    validationText: string = '';

    constructor(public dialogRef: MatDialogRef<NewOrgDialogComponent> , @Inject(MAT_DIALOG_DATA) public data: any) {
        this.orgCredsMap = data;
    }

    close(value : boolean) {
        if(value) {
            if(this.orgCred.authMode == 'soapLogin' && (!this.orgCred.loginUrl || !this.orgCred.orgName || !this.orgCred.password || !this.orgCred.username)) {
                this.validation = true;
                this.validationText = "Please enter all the input values";
            } else if(this.orgCred.authMode == 'accessToken' && (!this.orgCred.instanceUrl || !this.orgCred.orgName || !this.orgCred.accessToken)) {
                this.validation = true;
                this.validationText = "Please enter all the input values";
            } else if(this.orgCredsMap.has(this.orgCred.orgName)) {
            this.validation = true;
                this.validationText = "Duplicate org name";
            } else {
                this.dialogRef.close(this.orgCred);
            }
        } else {
            this.dialogRef.close();
        }
    }
}
