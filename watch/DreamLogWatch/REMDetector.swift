import HealthKit
import WatchConnectivity

class REMDetector: NSObject, WCSessionDelegate {
  private let healthStore = HKHealthStore()
  private var wcSession: WCSession?

  func start() {
    if WCSession.isSupported() {
      wcSession = WCSession.default
      wcSession?.delegate = self
      wcSession?.activate()
    }
    let hrvType = HKQuantityType.quantityType(forIdentifier: .heartRateVariabilitySDNN)!
    healthStore.requestAuthorization(toShare: nil, read: [hrvType]) { granted, _ in
      if granted { self.startHRVObserver() }
    }
  }

  private func startHRVObserver() {
    let hrvType = HKQuantityType.quantityType(forIdentifier: .heartRateVariabilitySDNN)!
    let query = HKObserverQuery(sampleType: hrvType, predicate: nil) { [weak self] _, _, error in
      guard error == nil else { return }
      self?.notifyiOS()
    }
    healthStore.execute(query)
  }

  private func notifyiOS() {
    wcSession?.sendMessage(["event": "rem_exit"], replyHandler: nil, errorHandler: nil)
  }

  func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {}
}
