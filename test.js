class RateLimitedAPIClient {
      // Constructor for the RateLimitedAPIClient
      constructor({
        maxInFlightRequests = 5,          // Maximum concurrent requests allowed
        delayBetweenRequests = 200,       // Delay in milliseconds between firing off each request
        maxRetryAttempts = 3,             // Maximum retries for 429 (rate-limit) errors
        retryDelay = 500,                 // Initial delay in milliseconds for retries
      }) {
        // Configurable properties from parameters
        this.maxInFlightRequests = maxInFlightRequests;
        this.delayBetweenRequests = delayBetweenRequests;
        this.maxRetryAttempts = maxRetryAttempts;
        this.retryDelay = retryDelay;
    
        // Keeping track of the number of requests currently "in flight"
        this.inFlightRequests = 0;
    
        // Queue to store the pending requests if maxInFlightRequests is reached
        this.pendingRequests = [];
      }
    
      async makeRequest(url, options, retryAttempt = 0) {
        // If the number of in-flight requests has reached its maximum, push the request into the queue
        if (this.inFlightRequests >= this.maxInFlightRequests) {
          return new Promise((resolve, reject) => {
            this.pendingRequests.push({url, options, resolve, reject, retryAttempt});
          });
        }
    
        try {
          // Increase the count of in-flight requests
          this.inFlightRequests++;
    
          // Make the actual request
          const response = await axios(url, options);
    
          // Decrease the count of in-flight requests since this request is done
          this.inFlightRequests--;
    
          // Check if there are pending requests to be made
          this.processNextPendingRequest();
    
          // Return the response data
          return response.data;
        } catch (error) {
          // If there's an error, decrease the count of in-flight requests
          this.inFlightRequests--;
    
          // If the error is due to rate limiting and we haven't reached the max retries
          if (error.response && error.response.status === 429 && retryAttempt < this.maxRetryAttempts) {
            console.warn(Rate limit error. Retrying after ${this.retryDelay * (retryAttempt + 1)}ms...);
    
            // Wait before retrying
            await this.sleep(this.retryDelay * (retryAttempt + 1));
    
            // Retry the request
            return this.makeRequest(url, options, retryAttempt + 1);
          }
    
          // If the request isn't due to rate-limiting or has exceeded max retries, process the next request
          this.processNextPendingRequest();
    
          // Throw the error
          throw error;
        }
      }
    
      // Helper function to process the next request in the queue
      async processNextPendingRequest() {
        // If there are no pending requests, just return
        if (this.pendingRequests.length === 0) {
          return;
        }
    
        // Wait for the specified delay before making the next request
        await this.sleep(this.delayBetweenRequests);
    
        // Get the next request from the queue
        const nextRequest = this.pendingRequests.shift();
    
        // Make the request and then resolve or reject based on its result
        this.makeRequest(nextRequest.url, nextRequest.options, nextRequest.retryAttempt)
          .then(nextRequest.resolve)
          .catch(nextRequest.reject);
      }
    
      // Simple sleep function
      sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
      }
    }
    
    // Example usage:
    (async () => {
      const client = new RateLimitedAPIClient({
        maxInFlightRequests: 5,
        delayBetweenRequests: 200,
        maxRetryAttempts: 3,
        retryDelay: 500,
      });
    
      try {
        const data = await client.makeRequest('https://api.example.com/data', { method: 'GET' });
        console.log(data);
      } catch (error) {
        console.error('Failed to fetch data:', error.message);
      }
    })();