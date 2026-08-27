import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { A11yModule } from '@angular/cdk/a11y';

@Component({
  selector: 'app-session-timeout-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, A11yModule],
  templateUrl: './session-timeout-dialog.component.html',
  styleUrls: ['./session-timeout-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SessionTimeoutDialogComponent implements OnInit, OnDestroy {
  /** Seconds remaining until auto-logout */
  @Input() secondsRemaining: number = 120;

  @Output() stayLoggedIn = new EventEmitter<void>();
  @Output() logoutNow   = new EventEmitter<void>();

  current: number = 120;
  private intervalId: any;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.current = this.secondsRemaining;
    this.intervalId = setInterval(() => {
      if (this.current > 0) {
        this.current--;
        this.cdr.markForCheck();
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.intervalId);
  }

  get formattedTime(): string {
    const m = Math.floor(this.current / 60);
    const s = this.current % 60;
    return m > 0
      ? `${m}:${s.toString().padStart(2, '0')}`
      : `${s}s`;
  }

  /** 0-1 progress value for the ring (1 = full, 0 = empty) */
  get progress(): number {
    return this.current / this.secondsRemaining;
  }

  /** SVG circle dash offset (circumference = 2π * r, r = 44) */
  get strokeDashoffset(): number {
    const circumference = 2 * Math.PI * 44;
    return circumference * (1 - this.progress);
  }

  get circumference(): number {
    return 2 * Math.PI * 44;
  }

  /** Color transitions: green → amber → red */
  get ringColor(): string {
    if (this.progress > 0.5) return '#4ade80';
    if (this.progress > 0.25) return '#fbbf24';
    return '#f87171';
  }
}
