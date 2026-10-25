import { Injectable } from '@nestjs/common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

export interface PlanEvent {
  planId: string;
  version: number;
  kind: string;
  at: string;
}

@Injectable()
export class RealtimeService {
  private readonly channels = new Map<string, Subject<PlanEvent>>();
  private readonly presenceChannels = new Map<string, BehaviorSubject<number>>();

  private channel(planId: string): Subject<PlanEvent> {
    let subject = this.channels.get(planId);
    if (!subject) {
      subject = new Subject<PlanEvent>();
      this.channels.set(planId, subject);
    }
    return subject;
  }

  emit(event: Omit<PlanEvent, 'at'>): void {
    this.channel(event.planId).next({ ...event, at: new Date().toISOString() });
  }

  stream(planId: string): Observable<PlanEvent> {
    return this.channel(planId).asObservable();
  }

  presence(planId: string): Observable<number> {
    let subject = this.presenceChannels.get(planId);
    if (!subject) {
      subject = new BehaviorSubject<number>(0);
      this.presenceChannels.set(planId, subject);
    }
    const channel = subject;

    return new Observable<number>((subscriber) => {
      channel.next(channel.value + 1);
      subscriber.next(channel.value);
      const subscription = channel.subscribe((count) => subscriber.next(count));
      return () => {
        subscription.unsubscribe();
        channel.next(Math.max(0, channel.value - 1));
      };
    });
  }
}