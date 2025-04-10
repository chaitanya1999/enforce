import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-alert-dialog',
  standalone: true,
  imports: [],
  templateUrl: './alert-dialog.component.html',
  styleUrl: './alert-dialog.component.css'
})
export class AlertDialogComponent {
    content = '';
    constructor(public dialogRef: MatDialogRef<AlertDialogComponent> , @Inject(MAT_DIALOG_DATA) public data: any) {
        this.content = data.content;
    }
    
    close(input: boolean) {
        this.dialogRef.close(input);
    }
}
