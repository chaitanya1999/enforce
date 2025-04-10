import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.css'
})
export class ConfirmDialogComponent {
    text: string;
    constructor(public dialogRef: MatDialogRef<ConfirmDialogComponent> , @Inject(MAT_DIALOG_DATA) public data: any) {
        this.text = data.text;
    }
    
    close(input: boolean) {
        this.dialogRef.close(input);
    }

}
